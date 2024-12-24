## TwitchAnalyticsBot

TwitchAnalyticsBot is an under-development Javascript program that has been used to log chat messages in real-time from one or more twitch.tv livestream.

The logged messages are then added to a SQLlite database created also by the program. From here, the messages can be queryed and used for analytical purposes. 

The code below is the main driver to map each chat message correctly and format the messages. 
```javascript
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
            `(${incrementUp()})(${named_channel})(${userID})(SUB) ${twitchName}: ${chatMessage}`
          );
        } else {
          console.log(
            `(${incrementUp()})(${named_channel})(${userID}) ${twitchName}: ${chatMessage}`
          );
        }

```
