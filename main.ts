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
		for await (const file of files) {
			if (file.isFile) {
				console.log('Compressing file:', file.name);
				//new Deno.Command(this.pngCrushPath);
			}
		}
	}
}

new App(Deno.args[0]).run();
