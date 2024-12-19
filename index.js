import { Client } from "tmi.js"; // This line is importing the tmi module. Short for "Twitch Messaging interface"
import axios from "axios"; // Axios module (HTTP requests)
import increment from "./counter.js"; // Counter module
import { DatabaseUtil } from "./database.js"; // Database module
import utils, { formatDate } from "./utils.js";

// This lines is required for the script. It is used to load the .env file.
import dotenv from "dotenv";
dotenv.config();

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
        for (let x = 0; x < response.data.data[0].user_name; x++) {
          //console.log(response.data.data[x].viewer_count);
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

(async () => {
  try {

    // Create a map to store the database for each channel
    const channelDbMap = new Map();

    console.log(channelDbMap);

    // Create Twitch client
    const c = new Client({
      connection: {
        secure: true,
        reconnect: true,
      },
      channels: ["xqc", "loltyler1","paymoneywubby", "zackrawrr"] // Add your desired channels here
    });

    // Connect to Twitch
    await c.connect();
    console.log("Connected to Twitch chat.");

    const channels = c.getOptions().channels;
    const cleanChannels = channels.map(channel => channel.replace(/^#/, ''));

    // Initialize the database
    console.log("Initializing databases...");

    for (const [index, channel] of cleanChannels.entries()) {
      console.log(`Channel ${index}: ${channel}`);
      const db = new DatabaseUtil(`${channel}`);
      await db.initDatabase();
      channelDbMap.set(channel, db); // Store the database instance in the map
      console.log(`Database initialized for channel: ${channel}`);
    };

    console.log("Databases initialized successfully.");

    // Handle messages from Twitch chat
    c.on("message", async (channel, tags, message) => {
      try {
        const cleanChannel = channel.replace(/^#/, ''); // Remove '#' prefix
        const db = channelDbMap.get(cleanChannel); // Get the database instance for the channel

        if (!db) {
          console.error(`No database found for channel: ${cleanChannel}`);
          return;
        }

        const chatMessage = message.replace(/'/g, "''");
        const formattedDate = utils.formatDate(new Date());
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

    // https://stackoverflow.com/questions/41292609/typeerror-callback-argument-must-be-a-function
    // (() => <function>, interval), this is necessary because setInterval expects a function as 
    // its first argument. Therefore, adding in () => db.processFile wraps it in a function, then triggers it. 
    
    // TODO: FIX THIS BELOW STATEMENT
    //setInterval(() => db.processDBFile(), 10000);

  } catch (err) {
    console.error("Error during initialization:", err);
  }
})();
