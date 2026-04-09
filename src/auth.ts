import dotenv from "dotenv";
dotenv.config();

import axios from "axios";

// ─── Interfaces ────────────────────────────────────────────────────────────

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ─── Token Cache ───────────────────────────────────────────────────────────

const clientId: string     = process.env.CLIENT_ID     ?? "";
const clientSecret: string = process.env.CLIENT_SECRET ?? "";

let cachedToken: string | null = null;
let tokenExpiry: number        = 0;

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getOAuthToken(): Promise<string> {
  // Return cached token if it's still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  if (!clientId || !clientSecret) {
    throw new Error("CLIENT_ID and CLIENT_SECRET must be set in your .env file.");
  }

  const response = await axios.post<TwitchTokenResponse>(
    "https://id.twitch.tv/oauth2/token",
    `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  cachedToken = response.data.access_token;
  tokenExpiry = Date.now() + response.data.expires_in * 1000;

  return cachedToken;
}

export default { getOAuthToken };