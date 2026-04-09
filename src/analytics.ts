import axios from "axios";

import { getOAuthToken } from "./auth.ts";
import { incrementUp } from "./utils.ts";
import { DatabaseUtil } from "./Database.ts";

// ─── Interfaces ────────────────────────────────────────────────────────────

// Raw stream object returned directly from the Twitch Helix API
interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: "live" | "";
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids: string[];
  tags: string[];
  is_mature: boolean;
}

// Mapped stream object used throughout the app
export interface StreamData {
  id: string;
  title: string;
  game_name: string;
  started_at: string;
  viewer_count: number;
  user_id: string;
  thumbnail_url: string;
  user_name: string;
  user_login: string;
}

// Return type for offlineOnlineStreams
interface StreamStatus {
  live: StreamData[];
  offline: string[];
}

// Twitch API paginated response wrapper
interface TwitchApiResponse<T> {
  data: T[];
  pagination?: { cursor?: string };
}

// ─── Functions ─────────────────────────────────────────────────────────────

// Sorts all Twitch channels by viewer count and displays the top 10
export async function getTopChannels(): Promise<TwitchStream[]> {
  const token = await getOAuthToken();

  return axios
    .get<TwitchApiResponse<TwitchStream>>("https://api.twitch.tv/helix/streams", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": process.env.CLIENT_ID,
      },
      params: { first: 10 },
    })
    .then((response) => {
      const channels = response.data.data;

      try {
        for (const channel of channels) {
          const viewerCount = channel.viewer_count;
          const userName = channel.user_name;
          console.log("Top channel #:", incrementUp(), userName, "with", viewerCount, "viewers");
        }
      } catch (err) {
        console.log(err);
      }

      return channels;
    })
    .catch((error) => {
      console.log(error);
      return [];
    });
}

// Gets raw stream data from the Twitch API and maps it to StreamData objects
export async function getStreamData(channels: string[]): Promise<StreamData[]> {
  const validChannels = channels.filter(c => c && c.trim() !== ''); // ✅
  if (!Array.isArray(validChannels) || validChannels.length === 0) {
    throw new Error("A non-empty array of channel names is required.");
  }

  const apiUrl = "https://api.twitch.tv/helix/streams";
  const queryParams = validChannels.map((channel) => `user_login=${channel}`).join("&");
  const token = await getOAuthToken();

  try {
    const response = await fetch(`${apiUrl}?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": process.env.CLIENT_ID!,  // '!' tells TS we know this is defined
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Twitch API request failed: ${response.statusText} — ${body}`);
    }

    const data = await response.json() as TwitchApiResponse<TwitchStream>;

    return data.data.map((stream) => ({
      id: stream.id,
      title: stream.title,
      game_name: stream.game_name,
      started_at: stream.started_at,
      viewer_count: stream.viewer_count,
      user_id: stream.user_id,
      thumbnail_url: stream.thumbnail_url,
      user_name: stream.user_login,
      user_login: stream.user_login,
    }));
  } catch (error) {
    console.error("Error fetching stream data:", error);
    return [];
  }
}

// Returns two lists: live channels and offline channel names
export async function offlineOnlineStreams(channels: string[]): Promise<StreamStatus> {
  if (!channels || channels.length === 0) {
    return { live: [], offline: [] };
  }

  try {
    const liveChannels = await getStreamData(channels);
    const liveChannelNames = liveChannels.map((stream) => stream.user_login.toLowerCase());
    const offlineChannels = channels.filter(
      (channel) => !liveChannelNames.includes(channel.toLowerCase())
    );

    return { live: liveChannels, offline: offlineChannels };
  } catch (error) {
    console.error("Error fetching stream data:", error);
    throw error;
  }
}

// Grabs total entry counts from each table in the DB
export async function getTablesCount(): Promise<void> {
  const db = new DatabaseUtil();
  db.openDatabase();
}

export default {
  getTopChannels,
  getStreamData,
  offlineOnlineStreams,
  getTablesCount,
};