class ErrorWithCode extends Error {
	constructor(public code: string, message: string) {
		super(message);
	}
}

const FILE_NOT_FOUND = 'ENOENT';

export function isFileNotFoundError(e: unknown) {
	return e && (e as ErrorWithCode).code === FILE_NOT_FOUND;
}