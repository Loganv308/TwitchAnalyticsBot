import cors from "cors";
import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import { DatabaseUtil } from "./src/Database.ts";
import { getStreamData, type StreamData } from "./src/analytics.ts";
import { LogStream } from "./src/logstream.ts";

// ─── Config ────────────────────────────────────────────────────────────────

dotenv.config();

const API_PORT = 3001;
const db       = new DatabaseUtil();

// ─── Log Setup ─────────────────────────────────────────────────────────────

const log = new LogStream({ 
  service: 'TwitchAnalyticsBot', 
  host: 'http://192.168.1.97:3000' 
});

// ─── Express ───────────────────────────────────────────────────────────────

const app = express();

app.use(cors());
app.use(express.static("public"));

// ─── In-memory store ───────────────────────────────────────────────────────
interface ChannelData {
  messages:    any[];
  mpm:         any[];
  topChatters: any[];
  subRatio:    any;
  updatedAt:   number;
}

const store      = new Map<string, ChannelData>();
let channelNames: string[] = [];
let liveMap: Map<string, StreamData> = new Map();
let channelStats: any[] = [];
let tableCounts:  any   = {};

async function refreshLiveMap(): Promise<void> {
  try {
    if (!channelNames.length) return;
    const liveStreams = await getStreamData(channelNames);
    liveMap = new Map(liveStreams.map(s => [s.user_login.toLowerCase(), s]));
    log.info(`Live map keys:`, { keys: [...liveMap.keys()] });
    log.info(`Channel stats keys:`, { keys: channelStats.map(s => s.channel)});
    log.info(`Live map refreshed: ${liveMap.size} live`);
  } catch (err) {
    log.error(`Live map error: ${err instanceof Error ? err.message : err}`);
  }
}
// ─── Refresh Materialized Views within database ────────────────────────────
async function refreshMaterializedViews(): Promise<void> {
  try {
    await db.refreshMaterializedViews();
    log.info('[DB] Materialized views refreshed');
  } catch (err) {
    log.error(`MV refresh error: ${err}`);
  }
}
// ─── Refresh a single channel ──────────────────────────────────────────────

async function refreshChannel(name: string): Promise<void> {
  try {
    // Messages and mpm are cheap — run together
    const [messages, mpm] = await Promise.all([
      db.getLatestMessages(name, 50, 0),
      db.getMessagesPerMinute(name),
    ]);

    // Top chatters and sub ratio are heavier — run after
    const [topChatters, subRatio] = await Promise.all([
      db.getTopChatters(name),
      db.getSubscriberRatio(name),
    ]);

    store.set(name, { messages, mpm, topChatters, subRatio, updatedAt: Date.now() });
  } catch (err) {
    log.error(`Refresh failed for ${name}: ${err}`);
  }
}

// ─── Main background loop ──────────────────────────────────────────────────

let storeReady = false;

async function refreshChannelsInBatches(): Promise<void> {
  const BATCH_SIZE = 3; // reduce from 5
  for (let i = 0; i < channelNames.length; i += BATCH_SIZE) {
    const batch = channelNames.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(name => refreshChannel(name)));
    // small pause between batches to let the DB breathe
    if (i + BATCH_SIZE < channelNames.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

async function backgroundRefresh(): Promise<void> {
  try {
    const [stats, counts] = await Promise.all([
      db.getChannelStats(),
      db.getTableCounts(),
    ]);
    channelStats = stats;
    tableCounts  = counts;
    await refreshChannelsInBatches();
    log.info(`[Store] Refreshed ${channelNames.length} channels`);
  } catch (err) {
    log.error(`Background refresh error: ${err}`);
  }
}

// ─── Routes — all served from memory, zero Supabase calls ─────────────────

app.get("/api/channels", (_req: Request, res: Response) => {
  const channels = channelStats.map(s => ({
    cleanChannel: s.channel,
    online:       liveMap.has(s.channel),
    stats:        s,
    stream:       liveMap.get(s.channel) ?? null,
  }));
  res.json({ channels, counts: tableCounts });
});

app.get("/api/channel/:name/messages", async (req: Request, res: Response) => {
  const name  = String(req.params.name).toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const messages = await db.getLatestMessages(name, limit);
  res.json(messages);
});

app.get("/api/channel/:name/stats/mpm", (req: Request, res: Response) => {
  const data = store.get(String(req.params.name).toLowerCase());
  res.json(data?.mpm ?? []);
});

app.get("/api/channel/:name/stats/top-chatters", (req: Request, res: Response) => {
  const data = store.get(String(req.params.name).toLowerCase());
  res.json(data?.topChatters ?? []);
});

app.get("/api/channel/:name/stats/subscriber-ratio", (req: Request, res: Response) => {
  const data = store.get(String(req.params.name).toLowerCase());
  res.json(data?.subRatio ?? {});
});

app.get("/api/channel/:name/streams", async (req: Request, res: Response) => {
  const name = String(req.params.name).toLowerCase();
  const rows = await db.getStreams(name);
  res.json(rows);
});

app.get("/api/status", (_req: Request, res: Response) => {
  res.json({ ready: storeReady, channels: channelNames.length });
});

// Search is the only route that hits Supabase on demand
// since it's user-triggered and can't be pre-cached
app.get("/api/channel/:name/search", async (req: Request, res: Response) => {
  const name     = String(req.params.name).toLowerCase();
  const username = req.query.username as string;
  if (!username) return res.status(400).json({ error: "Username is required" });

  const result = await db.searchUser(name, username);
  res.json(result);
});

async function boot(): Promise<void> {
  channelNames = await db.getChannelNames();
  await db.refreshMaterializedViews();

  const [stats, counts] = await Promise.all([
    db.getChannelStats(),
    db.getTableCounts(),
  ]);
  channelStats = stats;
  tableCounts  = counts;

  await refreshLiveMap();
  await refreshChannelsInBatches();
  storeReady = true;

  setInterval(refreshMaterializedViews, 5 * 60 * 1000);
  setTimeout(() => setInterval(backgroundRefresh, 5 * 60 * 1000), 30_000);     // offset by 30s
  setTimeout(() => setInterval(refreshLiveMap, 60_000), 15_000);               // offset by 15s
}

boot();

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(API_PORT, () => {
  log.info(`\nAPI server running  →  http://localhost:${API_PORT}`);
  log.info(`Dashboard           →  http://localhost:${API_PORT}/dashboard.html\n`);
});

process.on("unhandledRejection", (err) => {
  const message = err instanceof Error ? err.message : String(err);
  log.error(`Unhandled rejection: ${message}`);
});