import 'jsr:@std/dotenv/load';
import { parseArgs } from 'jsr:@std/cli/parse-args';
import { prettyBytes } from 'https://deno.land/x/pretty_bytes/mod.ts';
import { calculateChecksum, normalizeFilePath } from './file.ts';
import { StorageDb } from './storageDb.ts';
import { FileInfo } from './fileInfo.ts';
import { isFileNotFoundError } from './exception.ts';

class App {
	static readonly PNG_CRUSH_PATH_ENV = 'PNG_CRUSH_PATH';
	static readonly OPTI_PNG_PATH_ENV = 'OPTI_PNG_PATH';
	static readonly IGNORED_DIRECTORIES_ENV = 'IGNORE_DIRECTORIES';
	static readonly LOW_PRIORITY_DIRECTORIES_ENV = 'LOW_PRIORITY_DIRECTORIES';
	static readonly CACHE_FILE_NAME = 'cache.json';
	private pngCrushPath: string = '';
	private optiPngPath: string = '';
	private totalSizeBefore = 0;
	private totalSizeAfter = 0;
	private compressedSizeBefore = 0;
	private compressedSizeAfter = 0;
	private _db?: StorageDb;
	private ignoredDirectories: string[] = [];
	private lowPriorityDirectories: string[] = [];

	private get db(): StorageDb {
		if (!this._db)
			this._db = new StorageDb();
		return this._db;
	}

	private close() {
		this._db?.close();
	}

	constructor(private folder: string) {
	}

	private loadCompressorPath() {
		const pngCrushPath = Deno.env.get(App.PNG_CRUSH_PATH_ENV);
		if (pngCrushPath?.length) {
			console.log(App.PNG_CRUSH_PATH_ENV, '=', pngCrushPath);
			this.pngCrushPath = pngCrushPath;
		}
		const optiPngPath = Deno.env.get(App.OPTI_PNG_PATH_ENV);
		if (optiPngPath?.length) {
			console.log(App.OPTI_PNG_PATH_ENV, '=', optiPngPath);
			this.optiPngPath = optiPngPath;
		}
		if (!this.pngCrushPath.length && !this.optiPngPath.length)
			throw new Error('Need compressor: PngCrush or OptiPng');
		if (this.pngCrushPath.length && this.optiPngPath.length)
			throw new Error('Only one compressor is allowed: PngCrush or OptiPng');
	}

	private loadDirectories() {
		const IGNORED_DIRECTORIES = Deno.env.get(App.IGNORED_DIRECTORIES_ENV);
		if (IGNORED_DIRECTORIES?.length)
			this.ignoredDirectories = IGNORED_DIRECTORIES.split(',');
		console.log(App.IGNORED_DIRECTORIES_ENV, '=', this.ignoredDirectories);

		const LOW_PRIORITY_DIRECTORIES = Deno.env.get(App.LOW_PRIORITY_DIRECTORIES_ENV);
		if (LOW_PRIORITY_DIRECTORIES?.length)
			this.lowPriorityDirectories = LOW_PRIORITY_DIRECTORIES.split(',');
		console.log(App.LOW_PRIORITY_DIRECTORIES_ENV, '=', this.lowPriorityDirectories);
	}

	private clear() {
		this.totalSizeBefore = 0;
		this.totalSizeAfter = 0;
		this.compressedSizeBefore = 0;
		this.compressedSizeAfter = 0;
	}

	async run() {
		// Prepare
		this.clear();
		this.loadCompressorPath();
		this.loadDirectories();

		// Request permission
		Deno.readDir(this.folder);
		if (this.pngCrushPath.length)
			new Deno.Command(this.pngCrushPath).outputSync();
		if (this.optiPngPath.length)
			new Deno.Command(this.optiPngPath).outputSync();

		console.time('Total time');
		this.cleanDeadRecords(this.folder);
		await this.compressFolder(this.folder);
		console.timeEnd('Total time');

		// Print statistics
		console.log('Total size');
		console.log(' Before:', prettyBytes(this.totalSizeBefore));
		console.log(' After:', prettyBytes(this.totalSizeAfter));
		console.log('Compressed in this session');
		console.log(' Before:', prettyBytes(this.compressedSizeBefore));
		console.log(' After:', prettyBytes(this.compressedSizeAfter));

		this.findDuplicates(this.folder);
		this.close();
	}

	public showStatistics() {
		let totalSizeBefore = 0;
		let totalSizeAfter = 0;
		console.log('Total records:', this.db.getCount());
		this.db.forEach((item) => {
			totalSizeBefore += item.sizeBefore;
			totalSizeAfter += item.sizeAfter;
		});
		console.log('Total size');
		console.log(' Before:', prettyBytes(totalSizeBefore));
		console.log(' After:', prettyBytes(totalSizeAfter));
		console.log(' Total saved:', prettyBytes(totalSizeBefore - totalSizeAfter));
		console.log(' Total saved %:', ((totalSizeBefore - totalSizeAfter) / totalSizeBefore * 100).toFixed(1) + '%');
	}

	private async compressFolder(folder: string) {
		if (this.ignoredDirectories.includes(folder))
			return;
		const files = Deno.readDir(folder);
		for await (const fileRecord of files) {
			if (fileRecord.isFile && fileRecord.name.toLowerCase().endsWith('.png')) {
				const filePath = normalizeFilePath(folder + '/' + fileRecord.name);
				const fileSize = Deno.statSync(filePath).size;
				const fileInfo = this.readFileInfo(filePath);
				if (fileInfo && fileInfo.sizeAfter === fileSize) {
					// The file is already compressed
					this.totalSizeBefore += fileInfo.sizeBefore;
				} else {
					this.totalSizeBefore += fileSize;
					console.log('Compressing file:', filePath, prettyBytes(fileSize));
					await this.compressFile(filePath);
				}
				const fileSizeAfter = Deno.statSync(filePath).size;
				this.totalSizeAfter += fileSizeAfter;
			}
			if (fileRecord.isDirectory && fileRecord.name !== '.' && fileRecord.name !== '..')
				await this.compressFolder(folder + '/' + fileRecord.name);
		}
	}

	private cleanDeadRecords(folder: string) {
		const deadFiles: string[] = [];
		this.db.forEach((item) => {
			if (!item.fullName.startsWith(folder))
				return;
			let fileExists = false;
			try {
				fileExists = Deno.statSync(item.fullName).isFile && item.sizeAfter > 0;
			} catch (e) {
				if (isFileNotFoundError(e))
					fileExists = false;
				else
					throw e;
			}
			if (!fileExists)
				deadFiles.push(item.fullName);
		});
		deadFiles.forEach((fullName) => {
			this.db.delete(fullName);
		});
		if (deadFiles.length > 0)
			console.log('Deleted dead records:', deadFiles.length);
	}

	private findDuplicates(folder: string) {
		const checksumMap: Record<string, number> = {};
		this.db.forEach((item) => {
			if (!item.fullName.startsWith(folder))
				return;
			const count = checksumMap[item.checksum] || 0;
			checksumMap[item.checksum] = count + 1;
		});
		let duplicateCount = 0;
		for (const checksum in checksumMap) {
			if (checksumMap[checksum] > 1) {
				++duplicateCount;
			}
		}
		console.log('Duplicate files:', duplicateCount);
		let counter = 0;
		for (const checksum in checksumMap) {
			if (checksumMap[checksum] > 1) {
				++counter;
				console.log(counter, checksum);
				const items = this.db.findByChecksum(checksum);
				for (const item of items) {
					console.log(' ' + item.fullName);
					if (this.lowPriorityDirectories.some(lowPriorityDirectory => item.fullName.includes(lowPriorityDirectory))) {
						console.log(' deleting low priority duplicated file');
						Deno.removeSync(item.fullName);
					}
				}
			}
		}
	}

	private readFileInfo(filePath: string): FileInfo | undefined {
		return this.db.read(filePath);
	}

	private writeFileInfo(filePath: string, fileInfo: FileInfo) {
		this.db.write(filePath, fileInfo);
	}

	private async compressFile(filePath: string) {
		const fileSizeBefore = Deno.statSync(filePath).size;
		const output = this.compressFileCommand(filePath);
		if (output.code === 0) {
			const fileSizeAfter = Deno.statSync(filePath).size;
			if (fileSizeAfter === 0)
				console.warn(' compression failure detected');
			this.compressedSizeBefore += fileSizeBefore;
			this.compressedSizeAfter += fileSizeAfter;
			const ratio = fileSizeAfter / fileSizeBefore;
			const checksum = await calculateChecksum(filePath);
			this.writeFileInfo(filePath, new FileInfo(fileSizeBefore, fileSizeAfter, checksum));
			console.log(' done', (ratio * 100).toFixed(1) + '%');
		} else
			console.error(' failed:', filePath, '=>', output.code,
				'\n', new TextDecoder().decode(output.stdout),
				'\n', new TextDecoder().decode(output.stderr));
	}

	private compressFileCommand(filePath: string) {
		if (this.pngCrushPath.length)
			return new Deno.Command(this.pngCrushPath, { args: ['-ow', filePath] }).outputSync();
		if (this.optiPngPath.length)
			return new Deno.Command(this.optiPngPath, { args: [filePath, '-fix'] }).outputSync();
		throw new Error('Compressor path not found');
	}
}

const args = parseArgs(Deno.args, {
	string: ['dir'],
	boolean: ['stat', 'migrate'],
});

function main() {
	let done = false;
	if (args.dir) {
		new App(normalizeFilePath(args.dir)).run();
		done = true;
	}
	if (args.stat) {
		new App('').showStatistics();
		done = true;
	}
	if (!done)
		console.log('Nothing to do. Please supply command');
}

main();
