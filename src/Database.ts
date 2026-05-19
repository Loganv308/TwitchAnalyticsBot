import { Pool } from "pg";
import { LogStream } from "./logstream.ts";

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface MessageRow {
  message_id: string;
  channel_id: number;
  stream_id: string | null;
  user_id: string | null;
  username: string;
  message: string;
  timestamp: string;
  subscriber: boolean;
  is_bot: boolean;
}

export interface StreamRow {
  id: string;
  channel_id: number;
  title: string | null;
  game_name: string | null;
  started_at: string | null;
  peak_viewers: number | null;
}

export interface ChannelStats {
  channel: string;
  total_messages: number;
  unique_chatters: number;
  sub_messages: number;
  non_sub_messages: number;
  sub_pct: number;
}

export interface UserSearchResult {
  username: string;
  stats: {
    total_messages: number;
    subscriber_messages: number;
    first_seen: string;
    last_seen: string;
  };
  messages: MessageRow[];
}

export interface MessagesPerMinute {
  minute: string;
  count: number;
}

export interface SubscriberRatio {
  total_messages: number;
  subscriber_messages: number;
  percentage: number;
}

const pool = new Pool({
  host:     process.env.PGHOST,
  port:     Number(process.env.PGPORT || 5432),
  user:     process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max:      10,   // cap concurrent connections
  idleTimeoutMillis:    30_000,
  connectionTimeoutMillis: 5_000,
});

// ─── Log Setup ─────────────────────────────────────────────────────────────

const log = new LogStream({ 
  service: 'TwitchAnalyticsBot-DB', 
  host: 'http://192.168.1.97:3000' 
});


// ─── Class ─────────────────────────────────────────────────────────────────

export class DatabaseUtil {
  // ── Messages ─────────────────────────────────────────────────────────────

  async getLatestMessages(
    channelName: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MessageRow[]> {

    const query = `
      SELECT m.*
      FROM messages m
      INNER JOIN channels c ON m.channel_id = c.id
      WHERE c.name = $1
      ORDER BY m.timestamp DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await pool.query(query, [
        channelName,
        limit,
        offset,
      ]);

      return result.rows;
    } catch (error) {
      log.error(`Error fetching messages: ${error}`);
      return [];
    }
  }

  async getMessagesByStream(
    streamId: string,
    limit: number = 100
  ): Promise<MessageRow[]> {

    const query = `
      SELECT *
      FROM messages
      WHERE stream_id = $1
      ORDER BY timestamp ASC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [streamId, limit]);
      return result.rows;
    } catch (error) {
      log.error(`Error fetching stream messages: ${error}`);
      return [];
    }
  }

  // ── Streams ───────────────────────────────────────────────────────────────

  async getStreams(channelName: string): Promise<StreamRow[]> {

    const query = `
      SELECT s.*
      FROM streams s
      INNER JOIN channels c ON s.channel_id = c.id
      WHERE c.name = $1
      ORDER BY s.started_at DESC
    `;

    try {
      const result = await pool.query(query, [channelName]);
      return result.rows;
    } catch (error) {
      log.error(`Error fetching streams: ${error}`);
      return [];
    }
  }

  async getLatestStream(channelName: string): Promise<StreamRow | null> {
    const query = `
      SELECT s.*
      FROM streams s
      INNER JOIN channels c ON s.channel_id = c.id
      WHERE c.name = $1
      ORDER BY s.started_at DESC
      LIMIT 1
    `;

    try {
      const result = await pool.query(query, [channelName]);
      return result.rows[0] ?? null;
    } catch (error) {
      log.error(`Error fetching latest stream: ${error}`);
      return null;
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getChannelStats(): Promise<ChannelStats[]> {

    const query = `SELECT * FROM get_channel_stats()`;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      log.error(`Error fetching channel stats: ${error}`);
      return [];
    }
  }

  async getTopChatters(
    channelName: string,
    limit: number = 10
  ): Promise<{ username: string; message_count: number }[]> {

    const query = `
      SELECT *
      FROM get_top_chatters($1, $2)
    `;

    try {
      const result = await pool.query(query, [
        channelName,
        limit,
      ]);

      return result.rows;
    } catch (error) {
      log.error(`Error fetching top chatters: ${error}`);
      return [];
    }
  }

  async getChannelNames(): Promise<string[]> {

    const query = `SELECT name FROM public.channels`;

    try {
      const result = await pool.query(query);

      return result.rows.map((r: { name: string }) => r.name);
    } catch (error) {
      log.error(`Error fetching channel names: ${error}`);
      return [];
    }
  }

  async getTableCounts(): Promise<{ messages: number; streams: number; skipped: number }> {
    try {
      const result = await pool.query(`
        SELECT relname, n_live_tup
        FROM pg_stat_user_tables
        WHERE relname IN ('messages', 'streams', 'skipped_messages')
      `);

      const rowMap = new Map(result.rows.map(r => [r.relname, r.n_live_tup]));

      return {
        messages: Number(rowMap.get('messages') ?? 0),
        streams:  Number(rowMap.get('streams') ?? 0),
        skipped:  Number(rowMap.get('skipped_messages') ?? 0),
      };
    } catch (error) {
      log.error(`Error fetching table counts: ${error}`);
      return { messages: 0, streams: 0, skipped: 0 };
    }
  }

  async searchUser(channelName: string, username: string): Promise<UserSearchResult> {
    try {
      const [statsResult, messagesResult] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)::int AS total_messages,
            COUNT(*) FILTER (WHERE subscriber)::int AS subscriber_messages,
            MIN(timestamp) AS first_seen,
            MAX(timestamp) AS last_seen
          FROM messages m
          JOIN channels c ON m.channel_id = c.id
          WHERE c.name = $1
          AND m.username ILIKE $2
        `, [channelName, username]),

        pool.query(`
          SELECT m.*
          FROM messages m
          JOIN channels c ON m.channel_id = c.id
          WHERE c.name = $1
          AND m.username ILIKE $2
          ORDER BY m.timestamp DESC
          LIMIT 100
        `, [channelName, username]),
      ]);

      const stats = statsResult.rows[0];

      return {
        username,
        stats: {
          total_messages:      stats.total_messages,
          subscriber_messages: stats.subscriber_messages,
          first_seen:          stats.first_seen,
          last_seen:           stats.last_seen,
        },
        messages: messagesResult.rows,
      };

    } catch (error) {
      log.error(`Error searching user: ${error}`);
      return { username, stats: { total_messages: 0, subscriber_messages: 0, first_seen: '', last_seen: '' }, messages: [] };
    }
  }

  async refreshMaterializedViews(): Promise<void> {
    await Promise.all([
      pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY channel_stats_mv'),
      pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY top_chatters_mv'),
    ]);
  }

  async getMessagesPerMinute(channelName: string): Promise<MessagesPerMinute[]> {

    const query = `
      SELECT *
      FROM get_messages_per_minute($1)
    `;

    try {
      const result = await pool.query(query, [channelName]);
      return result.rows;
    } catch (error) {
      log.error(`Error fetching mpm: ${error}`);
      return [];
    }
  }

  async getSubscriberRatio(channelName: string): Promise<SubscriberRatio> {

    const query = `
      SELECT *
      FROM get_subscriber_ratio($1)
    `;

    try {
      const result = await pool.query(query, [channelName]);
      return result.rows[0] ?? { total_messages: 0, subscriber_messages: 0, percentage: 0 };
    } catch (error) {
      log.error(`Error fetching sub ratio: ${error}`);
      return { total_messages: 0, subscriber_messages: 0, percentage: 0 };
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    await pool.end();
  }
}