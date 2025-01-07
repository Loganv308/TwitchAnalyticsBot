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

      // Creates the tables in the databases
      await this.createTables();
    }
    else {
      console.log(`Database for ${this.dbName} exists, opening...` + '\n')

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

  // This method inserts the data into each database.  
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
    // If this can't find or connect to a DB, it will throw an error. 
    if (!this.db) {
      console.error('Database connection not initialized.');
      return;
    }
    
    // The DB Query, along with params that will be put into each database. 
    let query;
    let params;

    // Data to insert into "Streams" table for each database.
    if(tableName === 'Streams') {
      query = `
        INSERT INTO Streams (start_time, end_time, title, game)
        VALUES (?, ?, ?, ?)
      `;
      params = [startTime, endTime, title, game];
    
    // Data to insert into "Chat_messages" table for each database.
    } else if (tableName === 'Chat_messages') {
      query = `
        INSERT INTO Chat_messages (stream_id, user_id, username, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `;
      params = [streamID, userID, twitchName, chatMessage, formattedDate];
    
    // If no table is found, an error will be thrown. 
    } else {
      console.error(`Unknown table: ${tableName}`);
      return;
    }

    // Each time the data program detects a new Chat Message, it will run the query with the params 
    // into each database. 
    try {
      await this.db.run(query, params);
      console.log(`Data inserted into ${tableName} successfully.`);

    // Otherwise, it will error saying it wasn't able to put it into the database. 
    } catch (error) {
      console.log(`Error inserting data into ${tableName}: `, err);
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
