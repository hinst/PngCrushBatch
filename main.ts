import "jsr:@std/dotenv/load"
import { prettyBytes } from "https://deno.land/x/pretty_bytes@v2.0.0/mod.ts"

class FileInfo {
	constructor(public sizeBefore: number, public sizeAfter: number) {
	}
}

class App {
	static readonly PNG_CRUSH_PATH_ENV = 'PNG_CRUSH_PATH';
	static readonly CACHE_FILE_NAME = 'cache.json';
	private pngCrushPath: string;
	/** File path -> compressed size */
	private cache: Record<string, FileInfo> = {};
	private totalSizeBefore = 0;
	private totalSizeAfter = 0;
	private compressedSizeBefore = 0;
	private compressedSizeAfter = 0;

	constructor(private folder: string) {
		if (!folder?.length)
			throw new Error(App.PNG_CRUSH_PATH_ENV);
		this.pngCrushPath = this.loadPngCrushPath();
	}

	private get cacheFilePath() {
		return './' + App.CACHE_FILE_NAME;;
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
		this.loadCache();
		await this.compressFolder(this.folder);
		console.timeEnd('Total time');
		console.log('Total size');
		console.log('  Before:', prettyBytes(this.totalSizeBefore));
		console.log('  After:', prettyBytes(this.totalSizeAfter));
		console.log('Compressed size');
		console.log('  Before:', prettyBytes(this.compressedSizeBefore));
		console.log('  After:', prettyBytes(this.compressedSizeAfter));
	}


	private loadCache() {
		try {
			if (Deno.statSync(this.cacheFilePath))
				this.cache = JSON.parse(Deno.readTextFileSync(this.cacheFilePath));
		} catch (_) {
			// file not found
		}
	}

	private saveCache() {
		Deno.writeTextFileSync(this.cacheFilePath, JSON.stringify(this.cache, null, '\t'));
	}

	private async compressFolder(folder: string) {
		console.log('Compressing folder:', folder);
		const files = Deno.readDir(folder);
		let skippedCount = 0;
		for await (const fileInfo of files) {
			if (fileInfo.isFile && fileInfo.name.toLowerCase().endsWith('.png')) {
				const filePath = folder + '/' + fileInfo.name;
				const fileSize = Deno.statSync(filePath).size;
				this.totalSizeBefore += fileSize;
				if (this.cache[filePath]?.sizeAfter === fileSize)
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
			this.cache[filePath] = new FileInfo(fileSizeBefore, fileSizeAfter);
			this.saveCache();
			console.log('\tdone', (ratio * 100).toFixed(1) + '%');
		} else
			console.error('Failed:', filePath, '=>', output.code,
				'\n', new TextDecoder().decode(output.stdout),
				'\n', new TextDecoder().decode(output.stderr));
	}
}

new App(Deno.args[0]).run();
