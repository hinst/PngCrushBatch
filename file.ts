export const APP_PATH = import.meta.dirname;

export function normalizeFilePath(filePath: string): string {
	return filePath.replace(/\\/g, '/');
}
