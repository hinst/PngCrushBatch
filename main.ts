import "jsr:@std/dotenv/load"
import { prettyBytes } from "https://deno.land/x/pretty_bytes@v2.0.0/mod.ts"

class App {
	static readonly PNG_CRUSH_PATH_ENV = 'PNG_CRUSH_PATH';
	static readonly CACHE_FILE_NAME = 'cache.json';
	private pngCrushPath: string;
	/** File path -> compressed size */
	private cache: Record<string, number> = {};
	private totalSizeBefore = 0;
	private totalSizeAfter = 0;

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
		this.loadCache();
		await this.compressFolder();
		this.saveCache();
	}

	private loadCache() {
		try {
			if (Deno.statSync(this.cacheFilePath))
				this.cache = JSON.parse(Deno.readTextFileSync(this.cacheFilePath));
		} catch (e) {
		}
	}

	private saveCache() {
		Deno.writeTextFileSync(this.cacheFilePath, JSON.stringify(this.cache, null, '\t'));
	}

	private async compressFolder(folder?: string) {
		if (!folder)
			folder = this.folder;
		console.log('Compressing folder:', this.folder);
		const files = Deno.readDir(this.folder);
		for await (const fileName of files) {
			if (fileName.isFile && fileName.name.toLowerCase().endsWith('.png')) {
				const filePath = this.folder + '/' + fileName.name;
				const fileSize = Deno.statSync(filePath).size;
				if (this.cache[filePath] === fileSize)
					console.log('Skipping file:', filePath);
				else {
					console.log('Compressing file:', filePath, prettyBytes(fileSize));
					this.compressFile(filePath);
				}
			}
		}
	}

	private compressFile(filePath: string) {
		const fileSizeBefore = Deno.statSync(filePath).size;
		const postfix = (Math.random() * 999_999).toFixed();
		const outputFilePath = filePath + '.' + postfix;
		const output = new Deno.Command(this.pngCrushPath,
			{ args: [filePath, outputFilePath] }
		).outputSync();
		if (output.code === 0) {
			const fileSizeAfter = Deno.statSync(outputFilePath).size;
			this.totalSizeBefore += fileSizeBefore;
			this.totalSizeAfter += fileSizeAfter;
			const ratio = fileSizeAfter / fileSizeBefore;
			this.cache[filePath] = fileSizeBefore;
			console.log('\tdone', (ratio * 100).toFixed(1) + '%');
		} else
			console.error('Failed:', filePath, '=>', output.code,
				'\n', new TextDecoder().decode(output.stdout),
				'\n', new TextDecoder().decode(output.stderr));
	}
}

new App(Deno.args[0]).run();
