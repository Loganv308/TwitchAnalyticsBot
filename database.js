import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database connection module
// Will log errors to the error.log file and the console.
export class DatabaseUtil {
  
  constructor(dbName) {
    this.dbName = dbName;
    this.dbPath = path.join(__dirname, "data", `${dbName}.sqlite`);
  }

  async initDatabase() {
    await fs.ensureDir(path.dirname(this.dbPath));
    await fs.chmodSync(this.dbPath, 0o666);
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });
    await this.createTable();
  }

  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.dbName} (
        FAKE_ID INTEGER PRIMARY KEY,
        TIMESTAMP TEXT,
        USER_ACCID TEXT,
        TWITCH_NAME TEXT,
        CHAT_MESSAGE TEXT,
        CHANNEL TEXT
      )`;
    await this.db.exec(query);
  }

  async insertIntoDatabase(randID, formattedDate, userID, twitchName, chatMessage, named_channel) {
    if (!this.db) {
      console.error('Database connection not initialized.');
      return;
    }
  
    const query = `
      INSERT INTO ${this.dbName} 
      (FAKE_ID, TIMESTAMP, USER_ACCID, TWITCH_NAME, CHAT_MESSAGE, CHANNEL)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await this.db.run(query, randID, formattedDate, userID, twitchName, chatMessage, named_channel);
  }

  async closeDatabase() {
    if (this.db) {
      await this.db.close();
      console.log('Database connection closed.');
    }
  }
}
