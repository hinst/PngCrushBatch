export class FileInfo {
	constructor(public sizeBefore: number, public sizeAfter: number, public checksum: string) {
	}
}

export type FileInfoFields = {sizeBefore: number, sizeAfter: number, checksum: string};

export class FileInfoRow extends FileInfo {
	constructor(public fullName: string, sizeBefore: number, sizeAfter: number, checksum: string) {
		super(sizeBefore, sizeAfter, checksum);
	}
}

export type FileInfoRowFields = {fullName: string, sizeBefore: number, sizeAfter: number, checksum: string};
