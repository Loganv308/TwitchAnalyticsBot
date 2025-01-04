import { Client } from "tmi.js"; // This line is importing the tmi module. Short for "Twitch Messaging interface"
import { DatabaseUtil } from "./database.js"; // Database module
import { getStreamData, getTopChannels, offlineOnlineStreams } from "./analytics.js";
import utils, { formatDate, incrementUp } from "./utils.js";

(async () => {
  try {
    // Create a map to store the database for each channel
    const channelDbMap = new Map();

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

    try {
      console.log('Fetching stream data for channels:', cleanChannels);
      const { live, offline } = await offlineOnlineStreams(cleanChannels);
      
      console.log(`Live Channels (${live.length}):`, live);
      console.log(`Offline Channels (${offline.length}):`, offline);
    } catch (error) {
      console.error('Failed to fetch stream data:', error);
    }

    // Initialize the database
    console.log("Initializing databases...", '\n');
    
    for (const [index, channel] of cleanChannels.entries()) {
      console.log(`Channel ${index}: ${channel}`);
      const db = new DatabaseUtil(`${channel}`);
      await db.initDatabase();
      channelDbMap.set(channel, db); // Store the database instance in the map
      console.log(`Database initialized for channel: ${channel}`, '\n');
    };

    console.log("Databases initialized successfully.", '\n');

    // Handle messages from Twitch chat
    c.on("message", async (channel, tags, message) => {
      try {
        const cleanChannel = channel.replace(/^#/, ''); // Remove '#' prefix
        const db = channelDbMap.get(cleanChannel); // Get the database instance for the channel

        if (!db) {
          console.error(`No database found for channel: ${cleanChannel}`);
          return;
        }

        const chatMessage = message.replace(/'/g, "''"); // Message
        const formattedDate = utils.formatDate(new Date()); // Formatted date for Database
        const userID = tags["user-id"]; // Twitch User ID
        const twitchName = tags["display-name"]; // Twitch Display name
        const subscriber = tags["subscriber"]; // Subscriber status (T/F)
        const named_channel = channel.replace("#", "").toUpperCase(); // Channel name
        
        // // Insert into database
        // await db.insertIntoDatabase(
        //   randID,
        //   formattedDate,
        //   userID,
        //   twitchName,
        //   chatMessage,
        //   named_channel
        // );

        // Log the message
        if (subscriber == "1") {
          console.log(
            `(${incrementUp()})(${named_channel})(${userID})(SUB) ${twitchName}: ${chatMessage}`
          );
        } else {
          console.log(
            `(${incrementUp()})(${named_channel})(${userID}) ${twitchName}: ${chatMessage}`
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