import 'jsr:@std/dotenv/load';
import { parseArgs } from 'jsr:@std/cli/parse-args';
import { prettyBytes } from 'https://deno.land/x/pretty_bytes@v2.0.0/mod.ts';
import { normalizeFilePath } from './file.ts';
import { StorageDb } from './storageDb.ts';
import { FileInfo } from './fileInfo.ts';
import { existsSync } from "https://deno.land/std/fs/mod.ts";

class App {
	static readonly PNG_CRUSH_PATH_ENV = 'PNG_CRUSH_PATH';
	static readonly CACHE_FILE_NAME = 'cache.json';
	private pngCrushPath: string;
	private totalSizeBefore = 0;
	private totalSizeAfter = 0;
	private compressedSizeBefore = 0;
	private compressedSizeAfter = 0;

	constructor(private folder: string) {
		this.pngCrushPath = this.loadPngCrushPath();
	}

	private get cacheFilePath() {
		return './' + App.CACHE_FILE_NAME;
	}

	private loadPngCrushPath() {
		const PNG_CRUSH_PATH = Deno.env.get('PNG_CRUSH_PATH');
		console.log(App.PNG_CRUSH_PATH_ENV, '=', PNG_CRUSH_PATH);
		if (!PNG_CRUSH_PATH?.length)
			throw new Error(App.PNG_CRUSH_PATH_ENV + ' is required but not defined');
		if (!Deno.statSync(PNG_CRUSH_PATH).isFile)
			throw new Error(App.PNG_CRUSH_PATH_ENV + ' is defined but not a file');
		return PNG_CRUSH_PATH;
	}

	async run() {
		console.time('Total time');
		await this.compressFolder(this.folder);
		console.timeEnd('Total time');
		console.log('Total size');
		console.log('  Before:', prettyBytes(this.totalSizeBefore));
		console.log('  After:', prettyBytes(this.totalSizeAfter));
		console.log('Compressed size');
		console.log('  Before:', prettyBytes(this.compressedSizeBefore));
		console.log('  After:', prettyBytes(this.compressedSizeAfter));
	}

	showStatistics() {
		const db = new StorageDb();
		let totalSizeBefore = 0;
		let totalSizeAfter = 0;
		try {
			console.log('Total records:', db.getCount());
			db.forEach((item) => {
				totalSizeBefore += item.sizeBefore;
				totalSizeAfter += item.sizeAfter;
			});
			console.log('Total size');
			console.log('  Before:', prettyBytes(totalSizeBefore));
			console.log('  After:', prettyBytes(totalSizeAfter));
			console.log('  Total saved:', prettyBytes(totalSizeBefore - totalSizeAfter));
			console.log('  Total saved %:', ((totalSizeBefore - totalSizeAfter) / totalSizeBefore * 100).toFixed(1) + '%');
		} finally {
			db.close();
		}
	}

	private async compressFolder(folder: string) {
		console.log('Compressing folder:', folder);
		const files = Deno.readDir(folder);
		let skippedCount = 0;
		for await (const fileInfo of files) {
			if (fileInfo.isFile && fileInfo.name.toLowerCase().endsWith('.png')) {
				const filePath = normalizeFilePath(folder + '/' + fileInfo.name);
				const fileSize = Deno.statSync(filePath).size;
				this.totalSizeBefore += fileSize;
				if (this.getSizeAfter(filePath) === fileSize)
					++skippedCount;
				else {
					console.log('Compressing file:', filePath, prettyBytes(fileSize));
					this.compressFile(filePath);
				}
				const fileSizeAfter = Deno.statSync(filePath).size;
				this.totalSizeAfter += fileSizeAfter;
			}
			if (fileInfo.isDirectory && fileInfo.name !== '.' && fileInfo.name !== '..')
				await this.compressFolder(folder + '/' + fileInfo.name);
		}
		if (skippedCount)
			console.log('  skipped', skippedCount, 'files');
	}

	private getSizeAfter(filePath: string) {
		const db = new StorageDb();
		try {
			const sizeAfter = db.read(filePath)?.sizeAfter;
			return sizeAfter;
		} finally {
			db.close();
		}
	}

	private writeFileInfo(filePath: string, fileInfo: FileInfo) {
		const db = new StorageDb();
		try {
			db.write(filePath, fileInfo);
		} finally {
			db.close();
		}
	}

	private compressFile(filePath: string) {
		const fileSizeBefore = Deno.statSync(filePath).size;
		const output = new Deno.Command(this.pngCrushPath,
			{ args: ['-ow', filePath] }
		).outputSync();
		if (output.code === 0) {
			const fileSizeAfter = Deno.statSync(filePath).size;
			this.compressedSizeBefore += fileSizeBefore;
			this.compressedSizeAfter += fileSizeAfter;
			const ratio = fileSizeAfter / fileSizeBefore;
			this.writeFileInfo(filePath, new FileInfo(fileSizeBefore, fileSizeAfter));
			console.log('  done', (ratio * 100).toFixed(1) + '%');
		} else
			console.error('  failed:', filePath, '=>', output.code,
				'\n', new TextDecoder().decode(output.stdout),
				'\n', new TextDecoder().decode(output.stderr));
	}
}

const args = parseArgs(Deno.args, {
	string: ['dir'],
	boolean: ['stat'],
});

function main() {
	if (args.dir)
		new App(args.dir).run();
	if (args.stat)
		new App('').showStatistics();
	if (!args.dir?.length && !args.stat)
		console.log('Nothing to do. Need --dir');
}

main();
