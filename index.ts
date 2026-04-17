import cors from "cors";
import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import { DatabaseUtil } from "./src/Database.ts";

dotenv.config();

// ─── Config ────────────────────────────────────────────────────────────────

const API_PORT = 3001;
const db       = new DatabaseUtil();

// ─── Express ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.static("public"));

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /api/channels — sidebar stats for every channel
app.get("/api/channels", async (_req: Request, res: Response) => {
  try {
    const [stats, counts] = await Promise.all([
      db.getChannelStats(),
      db.getTableCounts(),
    ]);

    // Channel list comes from DB via getChannelStats — no hardcoded array needed
    const channels = stats.map(s => ({
      cleanChannel: s.channel,
      online:       false,   // live status handled by Python pipeline via streams table
      stats:        s,
      stream:       null,
    }));

    res.json({ channels, counts });
  } catch (err) {
    console.error("Error fetching channels:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/channel/:name/messages?limit=50&offset=0
app.get("/api/channel/:name/messages", async (req: Request, res: Response) => {
  const name  = String(req.params.name).toLowerCase();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const rows = await db.getLatestMessages(name, limit, offset);
  res.json(rows);
});

// GET /api/channel/:name/search?username=someuser
app.get("/api/channel/:name/search", async (req: Request, res: Response) => {
  const name     = String(req.params.name).toLowerCase();
  const username = req.query.username as string;

  if (!username) return res.status(400).json({ error: "Username is required" });

  const result = await db.searchUser(name, username);
  res.json(result);
});

// GET /api/channel/:name/stats/mpm
app.get("/api/channel/:name/stats/mpm", async (req: Request, res: Response) => {
  const name = String(req.params.name).toLowerCase();
  const rows = await db.getMessagesPerMinute(name);
  res.json(rows);
});

// GET /api/channel/:name/stats/top-chatters
app.get("/api/channel/:name/stats/top-chatters", async (req: Request, res: Response) => {
  const name = String(req.params.name).toLowerCase();
  const rows = await db.getTopChatters(name);
  res.json(rows);
});

// GET /api/channel/:name/stats/subscriber-ratio
app.get("/api/channel/:name/stats/subscriber-ratio", async (req: Request, res: Response) => {
  const name = String(req.params.name).toLowerCase();
  const row  = await db.getSubscriberRatio(name);
  res.json(row);
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