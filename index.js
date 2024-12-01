import { Client } from "tmi.js"; // This line is importing the tmi module. Short for "Twitch Messaging interface"
import {
  format as _format,
  transports as _transports,
} from "winston"; // Winston module (Logger)
import { stat } from "fs"; // File system module
import axios from "axios"; // Axios module (HTTP requests)
import increment from "./counter.js"; // Counter module

// This lines is required for the script. It is used to load the .env file.
import dotenv from "dotenv";
dotenv.config();

import { DatabaseUtil } from "./database.js"; // Database module

const db = new DatabaseUtil("ChatDatabase"); // Database connection
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

// This is the redirect URI. It is used to specify where the user will be redirected after the OAuth flow.
const redirectUri = "http://localhost/8080";

// This is the scope of the bot. It is used to specify what the bot can do.
const scope = "channel:read:subscriptions";

async function getOAuthToken() {
  const response = await axios({
    method: "post",
    url: "https://id.twitch.tv/oauth2/token",
    data: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials&redirect_uri=${redirectUri}&scope=${scope}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  console.log("Auth Token:", response.data.access_token);
  return response.data.access_token;
}

async function getTopChannels() {
  const token = await getOAuthToken();

  return axios
    .get("https://api.twitch.tv/helix/streams", {
      method: "get",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": process.env.CLIENT_ID,
      },
      params: {
        first: 10,
      },
    })
    .then((response) => {
      try {
        for (let x in response.data.data[0].user_name) {
          const viewerCount = response.data.data[x].viewer_count;
          const userName = response.data.data[x].user_name;
          console.log(
            "Top channel #:",
            increment(),
            userName,
            "with",
            viewerCount,
            "viewers"
          );
        }
      } catch (err) {
        console.log(err);
      }

      return response.data.data;
    })
    .catch((error) => {
      console.log(error);
    });
}

const processFile = () => {
  // This function is used to check the size of the database file. If it gets too big, it will exit the program.
  stat("TwitchBotDatabase.sqlite", (err, stats) => {
    if (err) {
      console.error(err);
      return;
    }

    if (stats.size > 100000000) {
      // 100MB
      console.error("File is too big, exiting");
      clearInterval(intervalId);
      process.exit();
    }
  });
};

setInterval(processFile, 10000);

(async () => {
  try {
    
    // Initialize the database
    console.log("Initializing database...");
    await db.initDatabase();
    console.log("Database initialized successfully.");

    // Create Twitch client
    const client = new Client({
      connection: {
        secure: true,
        reconnect: true,
      },
      channels: ["xqc"], // Add your desired channels here
    });

    // Handle messages from Twitch chat
    client.on("message", async (channel, tags, message) => {
      try {
        const chatMessage = message.replace(/'/g, "''");
        const formattedDate = new Date().toLocaleString("en-us", {
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        const userID = tags["user-id"]; // User ID
        const twitchName = tags["display-name"]; // Display name
        const subscriber = tags["subscriber"]; // Subscriber status
        const randID = Math.floor(Math.random() * 10_000_000_000); // Random ID
        const named_channel = channel.replace("#", "").toUpperCase(); // Channel name

        // Insert into database
        await db.insertIntoDatabase(
          randID,
          formattedDate,
          userID,
          twitchName,
          chatMessage,
          named_channel
        );

        // Log the message
        if (subscriber == "1") {
          console.log(
            `(${increment()})(${named_channel})(${userID})(SUB) ${twitchName}: ${chatMessage}`
          );
        } else {
          console.log(
            `(${increment()})(${named_channel})(${userID}) ${twitchName}: ${chatMessage}`
          );
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });

    // Connect to Twitch
    await client.connect();
    console.log("Connected to Twitch chat.");

  } catch (err) {
    console.error("Error during initialization:", err);
  }
})();

getTopChannels();
processFile();
