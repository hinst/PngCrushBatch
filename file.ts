export function normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}
