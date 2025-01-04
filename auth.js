// This lines is required for the script. It is used to load the .env file.
import dotenv from "dotenv";
dotenv.config();

import axios from "axios";

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

// This is the redirect URI. It is used to specify where the user will be redirected after the OAuth flow.
const redirectUri = "http://localhost/8080";

// This is the scope of the bot. It is used to specify what the bot can do.
const scope = "channel:read:subscriptions";

export async function getOAuthToken() {
  const response = await axios({
    method: "post",
    url: "https://id.twitch.tv/oauth2/token",
    data: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials&redirect_uri=${redirectUri}&scope=${scope}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  
  return response.data.access_token;
}

export default {
    getOAuthToken
}