import cors from "cors";
import express, { type Request, type Response } from "express";
import { Client, type ChatUserstate } from "tmi.js";

import { Channel } from "./src/Channel.js";
import { ChatMessage } from "./src/ChatMessage.js";
import { DatabaseUtil } from "./src/Database.js";
import { getStreamData, type StreamData } from "./src/analytics.js";
import utils from "./src/utils.js";

// ─── Config ────────────────────────────────────────────────────────────────

const CHANNELS: string[] = ["xqc", "paymoneywubby", "zackrawrr", "moonmoon", "summit1g", "bootyswagga", "dougdoug", "jynxzi", "cyr", "nadeshot", "pointcrow", "welyn", "dannyduncan", "georgehotz"];
const API_PORT: number   = 3001;

// ─── Interfaces ────────────────────────────────────────────────────────────

interface ChannelStats {
  total_messages: number;
  unique_chatters: number;
  subscriber_messages: number;
}

interface ChannelResult {
  cleanChannel: string;
  online: boolean;
  stats?: ChannelStats | undefined;
  stream?: StreamData | null;
  error?: string;
}

// ─── Express ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.static("public"));

// ─── State ─────────────────────────────────────────────────────────────────

let liveMap: Map<string, StreamData>   = new Map();
let channelDbMap: Map<string, DatabaseUtil> = new Map();

// ─── Live map ──────────────────────────────────────────────────────────────

async function refreshLiveMap(): Promise<void> {
  try {
    const validChannels = CHANNELS
      .map(c => c.replace(/^#/, "").toLowerCase()) // ✅ strip # prefix
      .filter(c => c.trim() !== "");
    
    console.log("Fetching stream data for:", validChannels);
    const liveStreams = await getStreamData(validChannels);
    liveMap = new Map(liveStreams.map(s => [s.user_login.toLowerCase(), s]));
    console.log(`Live map refreshed: ${liveMap.size} channels live`);
    console.log("Live channels:", [...liveMap.keys()]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to refresh live map:", message);
  }
}

refreshLiveMap();
setInterval(refreshLiveMap, 60000);

// ─── DB helper ─────────────────────────────────────────────────────────────

async function getConn(channel: string) {
  const db = new DatabaseUtil(channel);
  try {
    await db.openDatabase();
    const check = await db.connection?.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='Chat_messages'`
    );
    if (!check) return null;
    return db.connection;
  } catch {
    return null;
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /api/channels — sidebar stats for every channel
app.get("/api/channels", async (_req: Request, res: Response) => {
  const results: ChannelResult[] = [];

  for (const channel of CHANNELS) {
    const cleanChannel = channel.replace(/^#/, "").toLowerCase();
    const isLive       = liveMap.has(cleanChannel);
    const stream       = liveMap.get(cleanChannel) ?? null;

    console.log(`${cleanChannel}: isLive=${isLive}, in liveMap=${liveMap.has(cleanChannel)}`); // ✅

    const db = channelDbMap.get(cleanChannel);
    console.log(`DB for ${cleanChannel}: ${db ? "found" : "NOT FOUND"}`);
    if (!db?.connection) {
      results.push({ cleanChannel, online: false, error: "DB not found" });
      continue;
    }

    const stats = await db.connection.get<ChannelStats>(`
      SELECT
        COUNT(*)                                          AS total_messages,
        COUNT(DISTINCT user_id)                           AS unique_chatters,
        SUM(CASE WHEN subscriber = 1 THEN 1 ELSE 0 END)  AS subscriber_messages
      FROM Chat_messages
    `);
    results.push({ cleanChannel, online: isLive, stats, stream });
  }

  res.json(results);
});

// GET /api/channel/:name/messages?limit=50&offset=0
app.get("/api/channel/:name/messages", async (req: Request, res: Response) => {
  const name = req.params.name as string;
  if (!name) return res.status(400).json({ error: "Channel name is required" });

  const db = channelDbMap.get(name);
  if (!db?.connection) return res.status(404).json({ error: "DB not found" });

  const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const rows = await db.connection.all(
    `SELECT * FROM Chat_messages ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json(rows);
});

// GET /api/channel/:name/search?username=someuser
app.get("/api/channel/:name/search", async (req: Request, res: Response) => {
  const name = req.params.name as string;
  const username = req.query.username as string;

  if (!name) return res.status(400).json({ error: "Channel name is required" });
  if (!username) return res.status(400).json({ error: "Username is required" });

  const db = channelDbMap.get(name);
  if (!db || !db.connection) return res.status(404).json({ error: "DB not found" });

  const rows = await db.connection.all(`
    SELECT * FROM Chat_messages
    WHERE LOWER(username) = LOWER(?)
    ORDER BY timestamp DESC
    LIMIT 100
  `, [username]);

  const stats = await db.connection.get(`
    SELECT
      COUNT(*)                                          AS total_messages,
      SUM(CASE WHEN subscriber = 1 THEN 1 ELSE 0 END)  AS subscriber_messages,
      MIN(timestamp)                                    AS first_seen,
      MAX(timestamp)                                    AS last_seen
    FROM Chat_messages
    WHERE LOWER(username) = LOWER(?)
  `, [username]);

  res.json({ username, stats, messages: rows });
});

// GET /api/channel/:name/stats/mpm
app.get("/api/channel/:name/stats/mpm", async (req: Request, res: Response) => {
  const name = req.params.name as string;
  if (!name) return res.status(400).json({ error: "Channel name is required" });

  const conn = await getConn(name);
  if (!conn) return res.status(404).json({ error: "DB not found" });

  const rows = await conn.all(`
    SELECT
      strftime('%Y-%m-%dT%H:%M', timestamp) AS minute,
      COUNT(*) AS count
    FROM Chat_messages
    WHERE timestamp >= strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime', '-30 minutes')
    GROUP BY minute
    ORDER BY minute ASC
  `);
  await conn.close();
  res.json(rows);
});

// GET /api/channel/:name/stats/top-chatters
app.get("/api/channel/:name/stats/top-chatters", async (req: Request, res: Response) => {
  const name = req.params.name as string;
  if (!name) return res.status(400).json({ error: "Channel name is required" });

  const conn = await getConn(name);
  if (!conn) return res.status(404).json({ error: "DB not found" });

  const rows = await conn.all(`
    SELECT username, COUNT(*) AS message_count
    FROM Chat_messages
    GROUP BY username
    ORDER BY message_count DESC
    LIMIT 10
  `);
  await conn.close();
  res.json(rows);
});

// GET /api/channel/:name/stats/subscriber-ratio
app.get("/api/channel/:name/stats/subscriber-ratio", async (req: Request, res: Response) => {
  const name = req.params.name as string;
  if (!name) return res.status(400).json({ error: "Channel name is required" });

  const conn = await getConn(name);
  if (!conn) return res.status(404).json({ error: "DB not found" });

  const row = await conn.get(`
    SELECT
      SUM(CASE WHEN subscriber = 1 THEN 1 ELSE 0 END) AS sub_messages,
      SUM(CASE WHEN subscriber = 0 THEN 1 ELSE 0 END) AS non_sub_messages,
      COUNT(*)                                         AS total
    FROM Chat_messages
  `);
  await conn.close();
  res.json(row);
});

// Start API server
app.listen(API_PORT, () => {
  console.log(`\nAPI server running  →  http://localhost:${API_PORT}`);
  console.log(`Dashboard           →  http://localhost:${API_PORT}/dashboard.html\n`);
});

// ─── Database initializer ──────────────────────────────────────────────────

async function initializeDatabases(channels: string[]): Promise<Map<string, DatabaseUtil>> {
  for (const channel of channels) {
    const db = new DatabaseUtil(channel);
    await db.initDatabase();
    await db.createTables();
    channelDbMap.set(channel, db);
  }
  return channelDbMap;
}

// ─── Twitch bot ────────────────────────────────────────────────────────────

(async () => {
  try {
    const c = new Client({
      connection: { secure: true, reconnect: true },
      channels: CHANNELS,
    });

    await c.connect();
    console.log("Connected to Twitch chat.");

    const cleanChannels = c.getOptions().channels?.map(ch => ch.replace(/^#/, "")) ?? [];

    console.log("\nInitializing databases...\n");
    channelDbMap = await initializeDatabases(cleanChannels);
    console.log("Databases initialized.\n");

    // Fetch stream metadata and insert into Streams table
    const rawStreamData = await getStreamData(cleanChannels);

    const channelObjects = rawStreamData.map(stream => new Channel(
      stream.id,
      stream.title,
      stream.game_name,
      stream.started_at,
      stream.viewer_count,
      stream.user_id,
      stream.user_login,
    ));

    const groupedData = channelObjects.reduce<Record<string, Channel[]>>((acc, stream) => {
      const key = stream.getUserLogin();
      if (!acc[key]) acc[key] = [];
      acc[key].push(stream);
      return acc;
    }, {});

    for (const [user_login, streams] of Object.entries(groupedData)) {
      const db = channelDbMap.get(user_login);
      if (db) {
        await db.insertStreamData(streams.map(s => ({
          id:            s.getStreamID(),
          title:         s.getTitle(),
          game_name:     s.getGame(),
          started_at:    s.getStartTime() ?? "",
          viewer_count:  s.getViewerCount(),
          user_id:       s.getUserID() ?? "",
          thumbnail_url: "",
          user_name:     s.getUserLogin(),
          user_login:    s.getUserLogin(),
        })));
        console.log(`Stream data inserted for: ${user_login}`);
      }
    }

    // Map user_login → stream ID for tagging chat messages
    const userToStreamMap = new Map<string, string>();
    for (const channel of channelObjects) {
      userToStreamMap.set(channel.getUserLogin(), channel.getStreamID());
    }

    // ── Message handler ────────────────────────────────────────────────────
    c.on("message", async (channel: string, tags: ChatUserstate, messages: string) => {
      try {
        const user_login = channel.replace("#", "").toLowerCase();
        const db = channelDbMap.get(user_login);
        if (!db) return;

        const message_id = tags["id"]           ?? "UNKNOWN_MESSAGE_ID";
        const id         = userToStreamMap.has(user_login)
                             ? Number(userToStreamMap.get(user_login))
                             : null;
        const user_id    = tags["user-id"] ? Number(tags["user-id"]) : 0;
        const username   = tags["display-name"] ?? "Anonymous";
        const message    = messages ? messages.replace(/'/g, "''") : "[EMPTY MESSAGE]";
        const timestamp  = utils.formatDate(new Date());
        const subscriber = tags["subscriber"] ? 1 : 0;

        const chatMessage = new ChatMessage(
          message_id, id, user_id, username, message, timestamp, subscriber as 0 | 1
        );

        await db.insertChatData(chatMessage);

      } catch (err) {
        console.error("Error processing message:", err);
      }
    });

  } catch (err) {
    console.error("Error during initialization:", err);
  }
})();

// ─── Global error handler ──────────────────────────────────────────────────

process.on("unhandledRejection", (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Unhandled rejection:", message);
});