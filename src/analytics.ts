import { getOAuthToken } from "./auth.ts";

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

interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
}

interface TwitchApiResponse<T> {
  data: T[];
  pagination?: { cursor?: string };
}

export async function getStreamData(channels: string[]): Promise<StreamData[]> {
  const validChannels = channels.filter(c => c && c.trim() !== '');
  if (!validChannels.length) throw new Error("A non-empty array of channel names is required.");

  const token = await getOAuthToken();
  const queryParams = validChannels.map(c => `user_login=${c}`).join("&");

  try {
    const response = await fetch(`https://api.twitch.tv/helix/streams?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": process.env.TWITCH_CLIENT_ID!,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Twitch API error: ${response.statusText} — ${body}`);
    }

    const data = await response.json() as TwitchApiResponse<TwitchStream>;

    return data.data.map(stream => ({
      id:            stream.id,
      title:         stream.title,
      game_name:     stream.game_name,
      started_at:    stream.started_at,
      viewer_count:  stream.viewer_count,
      user_id:       stream.user_id,
      thumbnail_url: stream.thumbnail_url,
      user_name:     stream.user_login,
      user_login:    stream.user_login,
    }));
  } catch (error) {
    console.error("Error fetching stream data:", error);
    return [];
  }
}