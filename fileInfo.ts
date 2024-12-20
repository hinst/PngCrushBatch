export class FileInfo {
	constructor(public sizeBefore: number, public sizeAfter: number) {
	}
}

export class FileInfoRow extends FileInfo {
	constructor(public fullName: string, sizeBefore: number, sizeAfter: number) {
		super(sizeBefore, sizeAfter);
	}
}
