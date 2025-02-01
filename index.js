import { Client } from "tmi.js"; // This line is importing the tmi module. Short for "Twitch Messaging interface"
import { DatabaseUtil } from "./database.js"; // Database module
import { getStreamData, getTopChannels, offlineOnlineStreams } from "./analytics.js";
import utils, { formatDate, incrementUp } from "./utils.js";

const initializeDatabases = async (channels) => {
  const channelDbMap = new Map();

  for (const channel of channels) {
    const db = new DatabaseUtil(channel);
    await db.initDatabase(); // Initialize the database (creates/open + tables)
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
        channels: ["xqc","paymoneywubby", "zackrawrr"] // Add your desired channels here
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
      
      const transformedData = rawStreamData.map((stream) => ({
        id: stream.id,
        title: stream.title,
        game_name: stream.game_name, // Adjust as needed for your schema
        started_at: stream.started_at,
        viewer_count: stream.viewer_count,
        user_id: stream.user_id,
        user_login: stream.user_name, // Ensure we know the channel for grouping
      }));
  
      console.log('Transformed Data:', transformedData);
      
      const groupedData = transformedData.reduce((acc, stream) => {
        if (!acc[stream.user_login]) {
          acc[stream.user_login] = [];
        }
        acc[stream.user_login].push(stream);
        return acc;
        }, {});
    
      for (const [user_login, streams] of Object.entries(groupedData)) {
        const db = channelDbMap.get(user_login);
        
        db.createTables();

        if (db) {
          await db.insertStreamData(streams);
          console.log(`Data inserted for channel: ${user_login}`);
        } 
      }

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

        // Log the message
        if (subscriber == "1") {
          console.log(
            `(${incrementUp()})(${named_channel})(SUB) ${twitchName}: ${chatMessage}`
          );
        } else {
          console.log(
            `(${incrementUp()})(${named_channel}) ${twitchName}: ${chatMessage}`
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