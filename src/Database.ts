import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { StreamData } from "./analytics.ts";
import type { MessageData } from "./ChatMessage.ts";

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface MessageRow {
  message_id:  string;
  channel_id:  number;
  stream_id:   string | null;
  user_id:     string | null;
  username:    string;
  message:     string;
  timestamp:   string;
  subscriber:  boolean;
  is_bot:      boolean;
}

export interface StreamRow {
  id:           string;
  channel_id:   number;
  title:        string | null;
  game_name:    string | null;
  started_at:   string | null;
  peak_viewers: number | null;
}

export interface ChannelStats {
  channel:          string;
  total_messages:   number;
  unique_chatters:  number;
  sub_messages:     number;
  non_sub_messages: number;
  sub_pct:          number;
}

// ─── Class ─────────────────────────────────────────────────────────────────

export class DatabaseUtil {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment.");
    }

    this.client = createClient(url, key);
  }

  // ── Messages ─────────────────────────────────────────────────────────────

  // Fetch latest N messages for a channel
  async getLatestMessages(channelName: string, limit: number = 50, offset: number = 0): Promise<MessageRow[]> {
    const { data, error } = await this.client
      .from("messages")
      .select(`*, channels!inner(name)`)
      .eq("channels.name", channelName)
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) { console.error("Error fetching messages:", error); return []; }
    return (data as MessageRow[]).reverse();
  }

  // Fetch messages for a specific stream
  async getMessagesByStream(streamId: string, limit: number = 100): Promise<MessageRow[]> {
    const { data, error } = await this.client
      .from("messages")
      .select("*")
      .eq("stream_id", streamId)
      .order("timestamp", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Error fetching stream messages:", error);
      return [];
    }

    return data as MessageRow[];
  }

  // ── Streams ───────────────────────────────────────────────────────────────

  // Fetch all streams for a channel
  async getStreams(channelName: string): Promise<StreamRow[]> {
    const { data, error } = await this.client
      .from("streams")
      .select(`
        id,
        channel_id,
        title,
        game_name,
        started_at,
        peak_viewers,
        channels!inner(name)
      `)
      .eq("channels.name", channelName)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Error fetching streams:", error);
      return [];
    }

    return data as StreamRow[];
  }

  // Fetch most recent stream for a channel
  async getLatestStream(channelName: string): Promise<StreamRow | null> {
    const streams = await this.getStreams(channelName);
    return streams[0] ?? null;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  // Fetch message volume per channel
  async getChannelStats(): Promise<ChannelStats[]> {
    const { data, error } = await this.client.rpc("get_channel_stats");

    if (error) {
      console.error("Error fetching channel stats:", error);
      return [];
    }

    return data as ChannelStats[];
  }

  // Fetch most active chatters for a channel
  async getTopChatters(channelName: string, limit: number = 10): Promise<{ username: string; message_count: number }[]> {
    const { data, error } = await this.client.rpc("get_top_chatters", {
      channel_name: channelName,
      lim: limit,
    });

    if (error) { console.error("Error fetching top chatters:", error); return []; }
    return data;
  }

    // Fetch total row counts
    async getTableCounts(): Promise<{ messages: number; streams: number; skipped: number }> {
      const [messages, streams, skipped] = await Promise.all([
        this.client.from("messages").select("*", { count: "exact", head: true }),
        this.client.from("streams").select("*", { count: "exact", head: true }),
        this.client.from("skipped_messages").select("*", { count: "exact", head: true }),
      ]);

      return {
        messages: messages.count ?? 0,
        streams:  streams.count  ?? 0,
        skipped:  skipped.count  ?? 0,
      };
    }

  // Search messages by username in a channel
  async searchUser(channelName: string, username: string): Promise<object> {
    const { data: messages, error } = await this.client
      .from("messages")
      .select(`*, channels!inner(name)`)
      .eq("channels.name", channelName)
      .ilike("username", username)
      .order("timestamp", { ascending: false })
      .limit(100);

    if (error) { console.error("Error searching user:", error); return {}; }

    const total      = messages.length;
    const sub_msgs   = messages.filter(m => m.subscriber).length;
    const first_seen = messages.at(-1)?.timestamp ?? null;
    const last_seen  = messages.at(0)?.timestamp  ?? null;

    return {
      username,
      stats: { total_messages: total, subscriber_messages: sub_msgs, first_seen, last_seen },
      messages,
    };
  }

  // Messages per minute over last 30 minutes
  async getMessagesPerMinute(channelName: string): Promise<object[]> {
    const { data, error } = await this.client.rpc("get_messages_per_minute", { channel_name: channelName });
    if (error) { console.error("Error fetching mpm:", error); return []; }
    return data;
  }

  // Subscriber ratio for a channel
  async getSubscriberRatio(channelName: string): Promise<object> {
    const { data, error } = await this.client.rpc("get_subscriber_ratio", { channel_name: channelName });
    if (error) { console.error("Error fetching sub ratio:", error); return {}; }
    return data?.[0] ?? {};
  }

}