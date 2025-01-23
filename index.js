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
      channels: ["xqc","paymoneywubby", "zackrawrr"] // Add your desired channels here
    });

    // Connect to Twitch
    await c.connect();
    console.log("Connected to Twitch chat.");

    const channels = c.getOptions().channels;
    const cleanChannels = channels.map(channel => channel.replace(/^#/, ''));

    try {
      console.log('Fetching stream data for channels:', cleanChannels);

      const rawStreamData = await getStreamData(cleanChannels);

      if (rawStreamData.length === 0) {
        console.log('No live streams found.');
        return;
      }
      
      const transformedData = rawStreamData.map((stream) => ({
        streamID: stream.id,
        title: stream.title,
        game_name: stream.game_name, // Adjust as needed for your schema
        startedAt: stream.started_at,
        viewerCount: stream.viewer_count,
        userId: stream.user_id,
        thumbnailUrl: stream.thumbnail_url,
      }));
  
      console.log('Transformed Data:', transformedData);

      // const streamDb = new DatabaseUtil 
      
      // const { live, offline } = await offlineOnlineStreams(cleanChannels);

      // if (live.length > 0) {
      //   live.forEach((stream) => {
      //     console.log(`LIVE: Channel: ${stream.user_name}, Viewers: ${stream.viewer_count}, Title: ${stream.title}`);
      //   });
      // } else {
      //   console.log('No channels are currently live.');
      // }
      
      // if (offline.length > 0) {
      //   offline.forEach((channel) => {
      //     console.log(`OFFLINE: Channel: ${channel} is not live.`);
      //   });
      // }

    } catch (error) {
      console.error('Failed to fetch stream data:', error);
    }

    // Initialize the database log message
    console.log("Initializing databases...");
    
    // For each channel, this will initiate a new SQLite DB in the "data" directory. 
    for (const [index, channel] of cleanChannels.entries()) {
      console.log('\n' + `Channel ${index}: ${channel}`);
      const db = new DatabaseUtil(`${channel}`);
      await db.initDatabase();
      channelDbMap.set(channel, db); // Store the database instance in the map;
    };

    console.log('\n' + "Databases initialized successfully." + '\n');

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