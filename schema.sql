CREATE TABLE IF NOT EXISTS files(
    fullName TEXT PRIMARY KEY,
    sizeBefore INTEGER NOT NULL,
    sizeAfter INTEGER NOT NULL,
    checksum TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS files_fullName ON files (fullName);