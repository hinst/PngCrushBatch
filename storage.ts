import { DB } from 'https://deno.land/x/sqlite/mod.ts';
import { APP_PATH } from './file.ts';

export class Storage {
	private static readonly SCHEMA_FILE_NAME = 'schema.sql';
	private static readonly DB_FILE_NAME = 'info.db';
	private static _schema?: string;
	private isInitialized: boolean = false;

	private static get schema(): string {
		if (null === this._schema)
			this._schema = Deno.readTextFileSync(APP_PATH + '/' + Storage.SCHEMA_FILE_NAME);
		return this._schema || '';
	}

	private open() {
		const db = new DB(APP_PATH + '/' + Storage.DB_FILE_NAME);
		if (!this.isInitialized) {
			this.initialize(db);
			this.isInitialized = true;
		}
		return db;
	}

	private initialize(db: DB) {
		db.execute(Storage.schema);
	}
}