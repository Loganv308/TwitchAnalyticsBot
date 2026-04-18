import cors from "cors";
import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import { DatabaseUtil } from "./src/Database.ts";
import { getStreamData, type StreamData } from "./src/analytics.ts";

// ─── Config ────────────────────────────────────────────────────────────────

dotenv.config();

const API_PORT = 3001;
const db       = new DatabaseUtil();

// ─── Express ───────────────────────────────────────────────────────────────

const app = express();

app.use(cors());
app.use(express.static("public"));

let liveMap: Map<string, StreamData> = new Map();

async function refreshLiveMap(): Promise<void> {
  try {
    const channels = await db.getChannelNames();
    if (!channels.length) return;
    const liveStreams = await getStreamData(channels);
    liveMap = new Map(liveStreams.map(s => [s.user_login.toLowerCase(), s]));
    console.log(`Live map refreshed: ${liveMap.size} channels live`);
  } catch (err) {
    console.error("Failed to refresh live map:", err instanceof Error ? err.message : err);
  }
}

refreshLiveMap();
setInterval(refreshLiveMap, 60_000);

// ─── In-memory store ───────────────────────────────────────────────────────

interface ChannelCache {
  messages:    any[];
  mpm:         any[];
  topChatters: any[];
  subRatio:    any;
  updatedAt:   number;
}

const store = new Map<string, ChannelCache>();

// ─── Single background refresh loop ───────────────────────────────────────

async function refreshChannel(name: string): Promise<void> {
  try {
    const [messages, mpm, topChatters, subRatio] = await Promise.all([
      db.getLatestMessages(name, 50, 0),
      db.getMessagesPerMinute(name),
      db.getTopChatters(name),
      db.getSubscriberRatio(name),
    ]);

    store.set(name, { messages, mpm, topChatters, subRatio, updatedAt: Date.now() });
  } catch (err) {
    console.error(`Refresh failed for ${name}:`, err);
  }
}

async function refreshAllChannels(): Promise<void> {
  const channels = await db.getChannelNames();

  // Stagger requests — don't fire all channels at once
  for (const name of channels) {
    await refreshChannel(name);
    await new Promise(r => setTimeout(r, 200)); // 200ms between each channel
  }

  console.log(`Refreshed ${channels.length} channels`);
}

// Run once on startup, then every 10 seconds
refreshAllChannels();
setInterval(refreshAllChannels, 10_000);

// ─── Routes ────────────────────────────────────────────────────────────────

// ─── Cache ─────────────────────────────────────────────────────────────────

interface CacheEntry { data: any; expiresAt: number; }
const cache    = new Map<string, CacheEntry>();
const CACHE_TTL = 5_000; // match frontend poll interval

function getCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: any, ttl = CACHE_TTL): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

async function prefetchAllChannels(): Promise<void> {
  try {
    const channels = await db.getChannelNames();

    // All channels in parallel, not sequential
    await Promise.all(channels.map(async name => {
      try {
        const [messages, mpm, topChatters, subRatio] = await Promise.all([
          db.getLatestMessages(name, 50, 0),
          db.getMessagesPerMinute(name),
          db.getTopChatters(name),
          db.getSubscriberRatio(name),
        ]);
        setCache(`messages:${name}:50:0`, messages, 5_000);
        setCache(`mpm:${name}`,           mpm,      5_000);
        setCache(`top-chatters:${name}`,  topChatters, 30_000); // top chatters change slowly
        setCache(`sub-ratio:${name}`,     subRatio,    30_000); // sub ratio changes slowly
      } catch (err) {
        console.error(`Prefetch failed for ${name}:`, err);
      }
    }));

    console.log(`Prefetched ${channels.length} channels`);
  } catch (err) {
    console.error("Prefetch error:", err);
  }
}

// Prefetch on startup and every 30 seconds
prefetchAllChannels();
setInterval(prefetchAllChannels, 5_000);

// GET /api/channels — sidebar stats for every channel
app.get("/api/channels", async (_req: Request, res: Response) => {
  try {
    const cached = getCache("channels");
    if (cached) return res.json(cached);

    const [stats, counts] = await Promise.all([
      db.getChannelStats(),
      db.getTableCounts(),
    ]);

    const channels = stats.map(s => ({
      cleanChannel: s.channel,
      online:       liveMap.has(s.channel),
      stats:        s,
      stream:       liveMap.get(s.channel) ?? null,
    }));

    const result = { channels, counts };
    setCache("channels", result, 5_000);
    res.json(result);
  } catch (err) {
    console.error("Error fetching channels:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/channel/:name/messages", (req: Request, res: Response) => {
  const name  = String(req.params.name).toLowerCase();
  const data  = store.get(name);
  if (!data) return res.status(404).json({ error: "Channel not found or not yet loaded" });
  res.json(data.messages);
});

// GET /api/channel/:name/search?username=someuser
app.get("/api/channel/:name/search", async (req: Request, res: Response) => {
  const name     = String(req.params.name).toLowerCase();
  const username = req.query.username as string;
  if (!username) return res.status(400).json({ error: "Username is required" });

  const result = await db.searchUser(name, username);
  res.json(result);
});

app.get("/api/channel/:name/stats/mpm", (req: Request, res: Response) => {
  const name = String(req.params.name).toLowerCase();
  const data = store.get(name);
  if (!data) return res.status(404).json({ error: "Channel not found or not yet loaded" });
  res.json(data.mpm);
});

// GET /api/channel/:name/stats/top-chatters
app.get("/api/channel/:name/stats/top-chatters", (req: Request, res: Response) => {
  const name = String(req.params.name).toLowerCase();
  const data = store.get(name);
  if (!data) return res.status(404).json({ error: "Channel not found or not yet loaded" });
  res.json(data.topChatters);
});

// GET /api/channel/:name/stats/subscriber-ratio
app.get("/api/channel/:name/stats/subscriber-ratio", (req: Request, res: Response) => {
  const name = String(req.params.name).toLowerCase();
  const data = store.get(name);
  if (!data) return res.status(404).json({ error: "Channel not found or not yet loaded" });
  res.json(data.subRatio);
});

// GET /api/channel/:name/streams
app.get("/api/channel/:name/streams", async (req: Request, res: Response) => {
  const name = String(req.params.name).toLowerCase();
  const rows = await db.getStreams(name);
  res.json(rows);
});

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(API_PORT, () => {
  console.log(`\nAPI server running  →  http://localhost:${API_PORT}`);
  console.log(`Dashboard           →  http://localhost:${API_PORT}/dashboard.html\n`);
});

process.on("unhandledRejection", (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Unhandled rejection:", message);
});