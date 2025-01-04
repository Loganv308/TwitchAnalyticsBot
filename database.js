import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs-extra";

import { open } from "sqlite";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database connection module
// Will log errors to the error.log file and the console.
export class DatabaseUtil {
  
  constructor(dbName) {
    this.dbName = dbName;
    this.dbPath = path.join(__dirname, "data", `${dbName}Chat.sqlite`);
  }

  async initDatabase() {
    await fs.ensureDir(path.dirname(this.dbPath));
    if (!fs.existsSync(this.dbPath)) {
      await fs.writeFile(this.dbPath, ''); // Create an empty file
    }
    fs.chmodSync(this.dbPath, 0o666);
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });
    await this.createTables();
  }

  async createTables() {
    // The query below will create both tables we need to store data in. 
    // Streams is related to all the stream information, while Chat_messages is every chat message 
    // and information around that message. 
    const query = `
      CREATE TABLE IF NOT EXISTS Streams (
        stream_id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        title TEXT,
        game TEXT
        is_Live BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS Chat_messages (
        message_id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stream_id) REFERENCES Streams(stream_id)
      );
    `;
    await this.db.exec(query);
  }

  async insertIntoDatabase({
    tableName, 
    streamID,
    formattedDate,
    userID,
    twitchName,
    chatMessage,
    startTime,
    endTime,
    title,
    game
  }) {
    if (!this.db) {
      console.error('Database connection not initialized.');
      return;
    }
    
    let query;
    let params;

    if(tableName === 'Streams') {
      query = `
        INSERT INTO Streams (start_time, end_time, title, game)
        VALUES (?, ?, ?, ?)
      `;
      params = [startTime, endTime, title, game];
    } else if (tableName === 'Chat_messages') {
      // Insert into the Chat_messages table
      query = `
        INSERT INTO Chat_messages (stream_id, user_id, username, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `;
      params = [streamID, userID, twitchName, chatMessage, formattedDate];
    } else {
      console.error(`Unknown table: ${tableName}`);
      return;
    }

    try {
      await this.db.run(query, params);
      console.log(`Data inserted into ${tableName} successfully.`);
    } catch (error) {
      console.log(`Error inserting data into ${tableName}: `, err);
    }
  }

  async closeDatabase() {
    if (this.db) {
      await this.db.close();
      console.log('Database connection closed.');
    }
  }

  // This function is used to check the size of the database file. If it gets too big, it will exit the program.
  // --TODO:-- Instead of exiting the program, create a new database file(?). 
  async processDBFile() {
    fs.stat(this.dbPath, (err, stats) => {
      if (err) {
        console.error(err);
        return;
      }
      if (stats.size > 100000000) {
        // 100MB
        console.error("File is too big, exiting");
        clearInterval(intervalId);
        process.exit();
      }
    });
  };
}
