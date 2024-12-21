import { encodeHex } from 'https://deno.land/std/encoding/hex.ts';

export const APP_PATH = import.meta.dirname;

export function normalizeFilePath(filePath: string): string {
	return filePath.replace(/\\/g, '/');
}

const HASH_SUM_ALGORITHM = 'SHA-1';

export async function calculateChecksum(fullName: string): Promise<string> {
	const file = Deno.readFileSync(fullName);
	const hash = await crypto.subtle.digest(HASH_SUM_ALGORITHM, file);
	return encodeHex(hash);
}
