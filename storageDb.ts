import { DB } from 'https://deno.land/x/sqlite/mod.ts';
import { APP_PATH } from './file.ts';
import { FileInfo, FileInfoFields, FileInfoRow, FileInfoRowFields } from './fileInfo.ts';

export class StorageDb {
	private static readonly PAGE_SIZE = 1000;
	private static readonly SCHEMA_FILE_NAME = 'schema.sql';
	private static readonly DB_FILE_NAME = 'info.db';
	private static _schema?: string;
	private static get schema(): string {
		if (undefined == this._schema)
			this._schema = Deno.readTextFileSync(APP_PATH + '/' + StorageDb.SCHEMA_FILE_NAME);
		return this._schema || '';
	}
	private isInitialized: boolean = false;
	private _db?: DB;
	private get db(): DB {
		if (undefined == this._db)
			this._db = this.open();
		return this._db;
	}

	private open() {
		const db = new DB(APP_PATH + '/' + StorageDb.DB_FILE_NAME);
		if (!this.isInitialized) {
			this.initialize(db);
			this.isInitialized = true;
		}
		return db;
	}

	public close() {
		this._db?.close();
		this._db = undefined;
	}

	private initialize(db: DB) {
		db.execute(StorageDb.schema);
		db.execute('VACUUM');
	}

	public write(fullName: string, fileInfo: FileInfo) {
		this.db.query(
			'INSERT INTO files (fullName, sizeBefore, sizeAfter, checksum) ' +
				'VALUES (?, ?, ?) ON CONFLICT(fullName) DO UPDATE SET ' +
				'sizeBefore=excluded.sizeBefore, sizeAfter=excluded.sizeAfter',
			[fullName, fileInfo.sizeBefore, fileInfo.sizeAfter, fileInfo.checksum]
		);
	}

	public read(fullName: string): FileInfo | undefined {
		const rows = this.db.queryEntries<FileInfoFields>(
			'SELECT sizeBefore, sizeAfter, checksum FROM files WHERE fullName = ?', [fullName]);
		if (rows.length) {
			const row = rows[0];
			return new FileInfo(row.sizeBefore, row.sizeAfter, row.checksum);
		}
	}

	public forEach(callback: (item: FileInfoRow) => void) {
		const count = this.getCount();
		for (let offset = 0; offset < count; offset += StorageDb.PAGE_SIZE) {
			const rows = this.db.queryEntries<FileInfoRowFields>(
				'SELECT fullName, sizeBefore, sizeAfter, checksum FROM files LIMIT ? OFFSET ?',
				[StorageDb.PAGE_SIZE, offset]
			);
			for (const row of rows)
				callback(row);
		}
	}

	public getCount() {
		return this.db.query('SELECT COUNT(*) FROM files')[0][0] as number;
	}
}