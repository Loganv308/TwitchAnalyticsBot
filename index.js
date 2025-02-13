import { Client } from "tmi.js"; // This line is importing the tmi module. Short for "Twitch Messaging interface"
import { DatabaseUtil } from "./Database.js"; // Database module
import { getStreamData, getTopChannels, offlineOnlineStreams } from "./analytics.js";
import utils, { formatDate, incrementUp } from "./utils.js";
import { ChatMessage } from "./ChatMessage.js";
import { Channel } from "./Channel.js";

const TIMESTAMP = new Date();

// Work on this integrating this 
const ChannelObject = new Channel();

const initializeDatabases = async (channels) => {
  const channelDbMap = new Map();

  for (const channel of channels) {
    const db = new DatabaseUtil(channel);
    await db.initDatabase(); // Initialize the databases
    await db.createTables(); // Create the tables within the database for each channel
    channelDbMap.set(channel, db); // Store the instance in the map
  }
  return channelDbMap;
};

(async () => {
  try {
      // Create Twitch client
      const c = new Client({
        connection: {
          secure: true,
          reconnect: true,
        },
        channels: ["xqc","paymoneywubby", "zackrawrr", "moonmoon", "summit1g"] // Add your desired channels here
      });

      // Connect to Twitch
      await c.connect();

      console.log("Connected to Twitch chat.");

      const channels = c.getOptions().channels;

      const cleanChannels = channels.map(channel => channel.replace(/^#/, ''));

      // Initialize the database log message
      console.log('\n' + "Initializing databases..." + '\n');

      const channelDbMap = await initializeDatabases(cleanChannels);

      console.log('\n' + "Databases initialized successfully." + '\n');

      const rawStreamData = await getStreamData(cleanChannels);

      console.log(rawStreamData);
      
      const channelObjects  = rawStreamData.map((stream) => {
        return new Channel(
            stream.id,           // Stream ID
            stream.title,        // Title
            stream.game_name || stream.game,    // Game
            stream.started_at,   // Start Time
            stream.viewer_count, // Viewer Count
            stream.user_id,      // User ID
            stream.user_name    // User name of channel
        );
      });

      console.log('Transformed Data:', channelObjects);
      
      const groupedData = channelObjects.reduce((acc, stream) => {
        if (!acc[stream.user_login]) {
          acc[stream.user_login] = [];
        }
        acc[stream.user_login].push(stream);
        return acc;
        }, {});

      console.log(groupedData)
      
      for (const [user_login, streams] of Object.entries(groupedData)) {
        const db = channelDbMap.get(user_login);
        await db.insertStreamData(streams);
        console.log(`Data inserted for channel: ${user_login}`);
      
      }

      const userToStreamMap = new Map();

      for (const channel of channelObjects) {
        userToStreamMap.set(channel.getUserLogin(), channel.getStreamID());
      }

    // Handle messages from Twitch chat
    c.on("message", async (channel, tags, messages) => {
      try {
        const user_login = channel.replace("#", "").toLowerCase();
        const db = new DatabaseUtil(user_login);
        const isConnected = await db.openDatabase();

        // Debugging Logs
        // console.log("Tags Object:", tags);
        // console.log("Raw Message Data:", messages);
        // console.log("TIMESTAMP:", TIMESTAMP);
        // console.log("userToStreamMap:", userToStreamMap);
        console.log("user_login:", user_login);

        const message_id = tags?.["id"] || "UNKNOWN_MESSAGE_ID";
        const id = userToStreamMap?.get(user_login) ? Number(userToStreamMap.get(user_login)) : null;
        const user_id = tags?.["user-id"] ? Number(tags["user-id"]) : 0;
        const username = tags?.["display-name"] || "Anonymous";
        const message = messages ? messages.replace(/'/g, "''") : "[EMPTY MESSAGE]";
        const timestamp = TIMESTAMP ? utils.formatDate(TIMESTAMP) : new Date().toISOString();
        const subscriber = tags?.["subscriber"] ? 1 : 0; // Convert boolean to 0/1

        console.log('\n' + message_id + " " + id + " " + user_id + " " + username + " " + message + " " + timestamp + " " + subscriber );
        
        const chatMessage = new ChatMessage(message_id, id, user_id, username, message, timestamp, subscriber);

        if (isConnected) {
          if (!chatMessage || typeof chatMessage !== "object") {
            console.error("chatMessage is not an object:", chatMessage);
            return;
          } else {
            db.insertChatData(chatMessage);
          }
        } else {
          console.log("Database connection is not initialized.")
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