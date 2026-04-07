import { Client } from "tmi.js";
import express from "express";
import cors from "cors";
import { DatabaseUtil } from "./src/Database.js";
import { getStreamData } from "./src/analytics.js";
import utils from "./src/utils.js";
import { ChatMessage } from "./src/ChatMessage.js";
import { Channel } from "./src/Channel.js";

// ─── Config ────────────────────────────────────────────────────────────────
const CHANNELS = ["xqc", "paymoneywubby", "zackrawrr", "moonmoon", "summit1g"];
const API_PORT  = 3001;

// ─── Express API ───────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.static("public")); // serves public/dashboard.html

// Cache at the top of index.js
let liveMap = new Map();

let channelDbMap = new Map();

// Refresh it every 60 seconds
async function refreshLiveMap() {
  try {
    const liveStreams = await getStreamData(CHANNELS);
    liveMap = new Map(liveStreams.map(s => [s.user_login.toLowerCase(), s]));
    console.log(`Live map refreshed: ${liveMap.size} channels live`);
  } catch (err) {
    console.error("Failed to refresh live map, keeping existing data:", err.message);
    // ✅ liveMap stays as-is, no data loss
  }
}

refreshLiveMap();
setInterval(refreshLiveMap, 60000);

// Helper: open a fresh read connection to a channel's sqlite file
async function getConn(channel) {

  const db = new DatabaseUtil(channel);
  try {
    await db.openDatabase();
    // Verify the tables actually exist before returning
    const check = await db.connection.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='Chat_messages'`
    );
    if (!check) return null; // DB exists but tables aren't created yet
    return db.connection;
  } catch {
    return null;
  }
}

// GET /api/channels — sidebar stats for every channel
app.get("/api/channels", async (req, res) => {
  const results = [];

  for (const channel of CHANNELS) {

    const cleanChannel = channel.replace(/^#/, "").toLowerCase();
    
    const isLive = liveMap.has(cleanChannel); 
    
    const stream = liveMap.get(cleanChannel) || null;

    const conn = await getConn(cleanChannel);
    if (!conn) {
      results.push({ cleanChannel, online: false, error: "DB not found" });
      continue;
    }

    const stats = await conn.get(`
      SELECT
        COUNT(*) AS total_messages,
        COUNT(DISTINCT user_id) AS unique_chatters,
        SUM(CASE WHEN subscriber = 1 THEN 1 ELSE 0 END) AS subscriber_messages
      FROM Chat_messages
    `);

    await conn.close();
    results.push({ cleanChannel, online: isLive, stats, stream });
  }
  res.json(results);
});

// GET /api/channel/:name/messages?limit=50&offset=0
app.get("/api/channel/:name/messages", async (req, res) => {
  const db = channelDbMap.get(req.params.name);
  if (!db) return res.status(404).json({ error: "DB not found" });
  
  const limit  = Math.min(parseInt(req.query.limit) || 50, 200); // ✅
  const offset = parseInt(req.query.offset) || 0;  

  const rows = await db.connection.all(
    `SELECT * FROM Chat_messages ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json(rows);
});

// GET /api/channel/:name/stats/mpm — messages per minute, last 30 min
app.get("/api/channel/:name/stats/mpm", async (req, res) => {
  const conn = await getConn(req.params.name);
  if (!conn) return res.status(404).json({ error: "DB not found" });
  const rows = await conn.all(`
    SELECT
      strftime('%Y-%m-%dT%H:%M', timestamp) AS minute,
      COUNT(*)                              AS count
    FROM Chat_messages
    WHERE timestamp >= datetime('now', '-30 minutes')
    GROUP BY minute
    ORDER BY minute ASC
  `);
  await conn.close();
  res.json(rows);
});

// GET /api/channel/:name/stats/top-chatters
app.get("/api/channel/:name/stats/top-chatters", async (req, res) => {
  const conn = await getConn(req.params.name);
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
app.get("/api/channel/:name/stats/subscriber-ratio", async (req, res) => {
  const conn = await getConn(req.params.name);
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
const initializeDatabases = async (channels) => {

  for (const channel of channels) {
    const db = new DatabaseUtil(channel);
    await db.initDatabase();
    await db.createTables();
    channelDbMap.set(channel, db);
  }
  return channelDbMap;
};

// ─── Twitch bot ────────────────────────────────────────────────────────────
(async () => {
  try {
    const c = new Client({
      connection: { secure: true, reconnect: true },
      channels: CHANNELS,
    });

    await c.connect();
    console.log("Connected to Twitch chat.");

    const cleanChannels = c.getOptions().channels.map(ch => ch.replace(/^#/, ""));

    console.log("\nInitializing databases...\n");
    const channelDbMap = await initializeDatabases(cleanChannels);
    console.log("Databases initialized.\n");

    // Fetch stream metadata and insert into Streams table
    const rawStreamData = await getStreamData(cleanChannels);

    const channelObjects = rawStreamData.map(stream => new Channel(
      stream.id,
      stream.title,
      stream.game_name || stream.game,
      stream.started_at,
      stream.viewer_count,
      stream.user_id,
      stream.user_name,
    ));

    const groupedData = channelObjects.reduce((acc, stream) => {
      if (!acc[stream.user_login]) acc[stream.user_login] = [];
      acc[stream.user_login].push(stream);
      return acc;
    }, {});

    for (const [user_login, streams] of Object.entries(groupedData)) {
      const db = channelDbMap.get(user_login);
      if (db) {
        await db.insertStreamData(streams);
        console.log(`Stream data inserted for: ${user_login}`);
      }
    }

    // Map user_login → stream ID for tagging chat messages
    const userToStreamMap = new Map();
    for (const channel of channelObjects) {
      userToStreamMap.set(channel.getUserLogin(), channel.getStreamID());
    }

    // ── Message handler ──────────────────────────────────────────────────
    c.on("message", async (channel, tags, messages) => {
      try {
        const user_login = channel.replace("#", "").toLowerCase();
        const db = channelDbMap.get(user_login);
        if (!db) return;

        const message_id = tags?.["id"]           || "UNKNOWN_MESSAGE_ID";
        const id         = userToStreamMap.get(user_login)
                             ? Number(userToStreamMap.get(user_login))
                             : null;
        const user_id    = tags?.["user-id"]       ? Number(tags["user-id"]) : 0;
        const username   = tags?.["display-name"]  || "Anonymous";
        const message    = messages
                             ? messages.replace(/'/g, "''")
                             : "[EMPTY MESSAGE]";
        const timestamp  = utils.formatDate(new Date());
        const subscriber = tags?.["subscriber"]    ? 1 : 0;

        const chatMessage = new ChatMessage(
          message_id, id, user_id, username, message, timestamp, subscriber
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