import "jsr:@std/dotenv/load"

class App {
	static readonly PNG_CRUSH_PATH_ENV = 'PNG_CRUSH_PATH';
	private pngCrushPath: string;

	constructor(private folder: string) {
		if (!folder?.length)
			throw new Error(App.PNG_CRUSH_PATH_ENV);
		const PNG_CRUSH_PATH = Deno.env.get('PNG_CRUSH_PATH');
		console.log(App.PNG_CRUSH_PATH_ENV, '=', PNG_CRUSH_PATH);
		if (!PNG_CRUSH_PATH?.length)
			throw new Error(App.PNG_CRUSH_PATH_ENV + ' is required but not defined');
		if (!Deno.statSync(PNG_CRUSH_PATH).isFile)
			throw new Error(App.PNG_CRUSH_PATH_ENV + ' is defined but not a file');
		this.pngCrushPath = PNG_CRUSH_PATH;
	}

	async run(folder?: string) {
		if (!folder)
			folder = this.folder;
		console.log('Compressing folder:', this.folder);
		const files = Deno.readDir(this.folder);
		for await (const fileName of files) {
			if (fileName.isFile && fileName.name.toLowerCase().endsWith('.png')) {
				const filePath = this.folder + '/' + fileName.name;
				const postfix = (Math.random() * 999_999).toFixed();
				const outputFilePath = filePath + '.' + postfix;
				console.log('Compressing file:', filePath);
				const output = new Deno.Command(this.pngCrushPath,
					{ args: [filePath, outputFilePath] }
				).outputSync();
				if (output.code === 0) {
					const fileSizeBefore = Deno.statSync(filePath).size;
					const fileSizeAfter = Deno.statSync(outputFilePath).size;
					const ratio = fileSizeAfter / fileSizeBefore;
					console.log('\tdone', (ratio * 100).toFixed(1) + '%');
				} else {
					console.error('Failed:', fileName.name, '=>', output.code,
						'\n', new TextDecoder().decode(output.stdout),
						'\n', new TextDecoder().decode(output.stderr));
				}
			}
		}
	}
}

new App(Deno.args[0]).run();
