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
  constructor(dbName) {
    this.dbName = dbName;
    this.dbPath = path.join(__dirname, "data", `${dbName}_Chat.sqlite`);
  }

  // Initializes databases for all Twitch channels in Channel Arraylist (Index.js)
  async initDatabase() {
    
    // Ensures the directory exists in project directory, otherwise, creates a new one (/data)
    await fs.ensureDir(path.dirname(this.dbPath));
    
    // If DB doesn't exist, will create a new one along with setting the proper permissions.
    if (!fs.existsSync(this.dbPath)) {
      
      // Writes the new blank file (project_directory\data\{streamer}Database.db)
      await fs.writeFile(this.dbPath, ''); 
      
      // Opens the SQLite database. 
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });

      // Sets the proper permission, otherwise file becomes non-writable
      fs.chmodSync(this.dbPath, 0o666);

      console.log(`Database initialized for channel: ${dbName}`);

      // Creates the tables in the databases
      await this.createTables();
    }
    else {
      console.log(`Database for ${this.dbName} exists, opening...`)

      // Opens the SQLite database. This will only trigger if the DB's exist for each channel already. 
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });
    }
  }

  async createTables() {
    // The query below will create both tables we need to store data in. 
    // Streams is related to all the stream information, while Chat_messages is every chat message 
    // and information around that message such as userName, timeStamp, etc. 
    const query = `
      CREATE TABLE IF NOT EXISTS Streams (
        stream_id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        game TEXT,
        started_at TEXT,
        view_count INTEGER,
        user_id INTEGER,
        thumbnail_Url TEXT
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

  // This method inserts the data into each database.  
  async insertStreamData(streamData) {
    try {
      // If this can't find or connect to a DB, it will throw an error. 
      if (!this.db) {
        console.error('Database connection not initialized.');
        return;
      }

      const query = `
        INSERT INTO Streams (stream_id, title, game, started_at, view_count, user_id, thumbnail_url)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `;

      for (const stream of streamData) {
        await this.db.run(query, [
          stream.id,
          stream.title,        // Maps to the 'title' column
          stream.game,         // Maps to the 'game' column
          stream.started_at,    // Maps to the 'started_at' column
          stream.viewer_count,  // Maps to the 'view_count' column
          stream.user_id,       // Maps to the 'user_id' column
          stream.thumbnail_Url, // Maps to the 'thumbnail_url' column
        ]);
      }

    } catch(error) {
      console.error('Error inserting data into the database:', error);
    }
  }

  // This closes the DB connection when needed. 
  async closeDatabase() {
    if (this.db) {
      await this.db.close();
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
