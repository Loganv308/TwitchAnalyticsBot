import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs-extra";

import { open, Database } from "sqlite";
import { fileURLToPath } from "url";

import type { StreamData } from "./analytics.ts";
import type { MessageData } from "./ChatMessage.ts";

// ─── Interfaces ────────────────────────────────────────────────────────────

interface TableRow {
  name: string;
}

// ─── Setup ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Class ─────────────────────────────────────────────────────────────────

export class DatabaseUtil {
  private dbName: string;
  private dbPath: string;
  public connection: Database | null;

  constructor(dbName: string = "") {
    this.dbName     = dbName;
    this.dbPath     = path.join(__dirname, "data", `${dbName}_Chat.sqlite`);
    this.connection = null;
  }

  async openDatabase(): Promise<boolean> {
    this.connection = await open({
      filename: this.dbPath,
      driver:   sqlite3.Database,
    });
    // WAL mode allows simultaneous reads and writes
    await this.connection.run("PRAGMA journal_mode=WAL;");
    // Wait up to 5s for a lock to clear instead of immediately erroring
    await this.connection.run("PRAGMA busy_timeout=5000;");
    return this.connection !== null;
  }

  // Initializes the database file for a channel if it doesn't exist
  async initDatabase(): Promise<void> {
    await fs.ensureDir(path.dirname(this.dbPath));
    const isNew = !fs.existsSync(this.dbPath);

    if (isNew) {
      await fs.writeFile(this.dbPath, "");
      fs.chmodSync(this.dbPath, 0o666);
      console.log(`Database initialized for channel: ${this.dbName}`);
    } else {
      console.log(`Database for ${this.dbName} exists, opening...`);
    }

    await this.openDatabase();
  }

  // Creates Streams and Chat_messages tables if they don't already exist
  async createTables(): Promise<void> {
    if (!this.connection) {
      console.error("Database connection not initialized.");
      return;
    }

    try {
      const rows = await this.connection.all<TableRow[]>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)`,
        ["Streams", "Chat_messages"]
      );

      const existingTables = rows.map((row) => row.name);
      if (existingTables.includes("Streams") && existingTables.includes("Chat_messages")) {
        console.log("Tables already exist.");
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
    } catch (error) {
      console.error(error);
    }
  }

  // Inserts stream metadata into the Streams table
  async insertStreamData(streamData: StreamData[]): Promise<void> {
    if (!this.connection) {
      console.error("Database connection not initialized.");
      return;
    }

    const query = `
      INSERT OR REPLACE INTO Streams (id, user_login, title, game_name, started_at, view_count, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    try {
      for (const stream of streamData) {
        await this.connection.run(query, [
          stream.id,
          stream.user_login,
          stream.title,
          stream.game_name,
          stream.started_at,
          stream.viewer_count,
          stream.user_id,
        ]);
      }
    } catch (error) {
      console.error("Error inserting data into the database:", error);
    }
  }

  // Inserts a single chat message into the Chat_messages table
  async insertChatData(chatMessage: MessageData): Promise<void> {
    if (!this.connection) {
      console.error("Database connection not initialized.");
      return;
    }

    const sanitizedData: [string, number | null, number, string, string, string, 0 | 1] = [
      chatMessage.message_id || "UNKNOWN_ID",
      chatMessage.id         ?? null,
      chatMessage.user_id    || 0,
      chatMessage.username   || "Anonymous",
      chatMessage.message    || "[EMPTY MESSAGE]",
      chatMessage.timestamp  || new Date().toISOString(),
      chatMessage.subscriber,
    ];

    const query = `
      INSERT INTO Chat_messages (message_id, id, user_id, username, message, timestamp, subscriber)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    try {
      await this.connection.run(query, sanitizedData);
    } catch (error) {
      console.error("Error inserting data into the database:", error);
    }
  }

  // Closes the database connection
  async closeDatabase(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      console.log("Database connection closed.");
    }
  }
}