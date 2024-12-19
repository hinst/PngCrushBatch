import { DB } from 'https://deno.land/x/sqlite/mod.ts';
import { APP_PATH } from './file.ts';
import { FileInfo } from './fileInfo.ts';

export class StorageDb {
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
		this.db.execute('VACUUM');
		this._db?.close();
		this._db = undefined;
	}

	private initialize(db: DB) {
		db.execute(StorageDb.schema);
	}

	public write(fullName: string, fileInfo: FileInfo) {
		const db = this.db;
		db.query(
			'INSERT INTO files (fullName, sizeBefore, sizeAfter) ' +
				'VALUES (?, ?, ?) ON CONFLICT(fullName) DO UPDATE SET ' +
				'sizeBefore=excluded.sizeBefore, sizeAfter=excluded.sizeAfter',
			[fullName, fileInfo.sizeBefore, fileInfo.sizeAfter]
		);
	}
}