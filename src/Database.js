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

    console.log(this.connection);

    return this.connection !== null;
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
      this.connection = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });

      // Sets the proper permission, otherwise file becomes non-writable
      fs.chmodSync(this.dbPath, 0o666);

      console.log(`Database initialized for channel: ${this.dbName}`);

      // Creates the tables in the databases
      await this.createTables();
    }
    else {
      console.log(`Database for ${this.dbName} exists, opening...`)

      // Opens the SQLite database. This will only trigger if the DB's exist for each channel already. 
      this.connection = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });
    }
  }

  // The query below will create both tables we need to store data in. 
  // Streams is related to all the stream information, while Chat_messages is every chat message 
  // and information around that message such as userName, timeStamp, etc. 
  async createTables() {

    const streamTable = 'Streams';
    const chatTable = 'Chat_messages';
    
    try {
      this.connection = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });

      const rows = await this.connection.all(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)`, 
        [streamTable, chatTable]
      );

      const existingTables = rows.map(row => row.name);

      if (existingTables.includes(streamTable) && existingTables.includes(chatTable)) {
          console.log(`Tables "${streamTable}" and "${chatTable}" exist.`);
          return; // Exit function if tables exist
      } else {
          const query = `
            CREATE TABLE IF NOT EXISTS Streams (
              id TEXT PRIMARY KEY ,
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
          `;
          
          await this.connection.exec(query);
          
          console.log("Tables created successfully.");
        }
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

      console.log(`Santized Data final: `, sanitizedData);

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
