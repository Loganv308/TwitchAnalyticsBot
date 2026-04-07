import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs-extra";

import { open } from "sqlite";
import { fileURLToPath } from "url";

// File path to project. 
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database connection module
export class DatabaseUtil {
  
  // Default constructor. DbName is the Channel name, dbPath goes to the database file path. 
  constructor(dbName = null) {
    this.dbName = dbName;
    this.dbPath = path.join(__dirname, "data", `${dbName}_Chat.sqlite`);
    this.connection = null; // Placeholder for the SQLite database instance
  }

  async openDatabase() {
    this.connection = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });
    // ✅ WAL mode on every open — allows simultaneous reads and writes
    await this.connection.run('PRAGMA journal_mode=WAL;');
    await this.connection.run('PRAGMA busy_timeout=5000;'); // ✅ wait up to 5s instead of immediately erroring
    return this.connection !== null;
  }

  // Initializes databases for all Twitch channels in Channel Arraylist (Index.js)
  async initDatabase() {
    await fs.ensureDir(path.dirname(this.dbPath));
    const isNew = !fs.existsSync(this.dbPath);
    
    if (isNew) {
      await fs.writeFile(this.dbPath, '');
      fs.chmodSync(this.dbPath, 0o666);
      console.log(`Database initialized for channel: ${this.dbName}`);
    } else {
      console.log(`Database for ${this.dbName} exists, opening...`);
    }

    await this.openDatabase(); // ✅ always use openDatabase, WAL is set there
  }

  // The query below will create both tables we need to store data in. 
  // Streams is related to all the stream information, while Chat_messages is every chat message 
  // and information around that message such as userName, timeStamp, etc. 
  async createTables() {
    try {
      const rows = await this.connection.all(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)`,
        ['Streams', 'Chat_messages']
      );
      const existingTables = rows.map(row => row.name);
      if (existingTables.includes('Streams') && existingTables.includes('Chat_messages')) {
        console.log(`Tables already exist.`);
        return;
      }
      await this.connection.exec(`
        CREATE TABLE IF NOT EXISTS Streams (
          id TEXT PRIMARY KEY,
          user_login TEXT,
          title TEXT,
          game_name TEXT,
          started_at TEXT,
          view_count INTEGER,
          user_id INTEGER
        );
        CREATE TABLE IF NOT EXISTS Chat_messages (
          message_id TEXT PRIMARY KEY,
          id INTEGER,
          user_id INTEGER,
          username TEXT,
          message TEXT,
          timestamp TEXT,
          subscriber INTEGER,
          FOREIGN KEY (id) REFERENCES Streams(id)
        );
      `);
      console.log("Tables created successfully.");
    } catch(error) {
      console.error(error);
    }
  }

  // This method inserts the data into each database.  
  async insertStreamData(streamData) {
    try {
      // If this can't find or connect to a DB, it will throw an error. 
      if (!this.connection) {
        console.error('Database connection not initialized.');
        return;
      }

      const query = `
        INSERT OR REPLACE INTO Streams (id, user_login, title, game_name, started_at, view_count, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `;

      for (const stream of streamData) {
        await this.connection.run(query, [
          stream.id,     // Maps to the 'id' column
          stream.user_login,    // Maps to the 'user_login' column
          stream.title,         // Maps to the 'title' column
          stream.game_name,     // Maps to the 'game' column
          stream.started_at,    // Maps to the 'started_at' column
          stream.viewer_count,  // Maps to the 'view_count' column
          stream.user_id,       // Maps to the 'user_id' column
        ]);
      }
      
    } catch(error) {
      console.error('Error inserting data into the database:', error);
    }
  }

  async insertChatData(chatMessage) {
    try {
      if (!this.connection) {
        console.error('Database connection not initialized.');
        return;
      }

      const sanitizedData = [
        chatMessage.message_id ? String(chatMessage.message_id) : "UNKNOWN_ID",
        chatMessage.id ? parseInt(chatMessage.id, 10) : null,  
        chatMessage.user_id ? parseInt(chatMessage.user_id, 10) : 0,  
        chatMessage.username ? String(chatMessage.username) : "Anonymous",
        chatMessage.message ? String(chatMessage.message) : "[EMPTY MESSAGE]",
        chatMessage.timestamp ? String(chatMessage.timestamp) : new Date().toISOString(),
        chatMessage.subscriber ? 1 : 0
    ];

      const query = `
      INSERT INTO Chat_messages (message_id, id, user_id, username, message, timestamp, subscriber)
      VALUES (?, ?, ?, ?, ?, ?, ?);
      `;

      await this.connection.run(query, sanitizedData);

    } catch(error) {
      console.error('Error inserting data into the database:', error)
    }
  }

  // This closes the DB connection when needed. 
  async closeDatabase() {
    if (this.connection) {
      await this.connection.close();
      console.log('Database connection closed.');
    }
  }

  // This function is used to check the size of the database file. If it gets too big,
  // it will exit the program.
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
