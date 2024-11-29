## TwitchAnalyticsBot

TwitchDatabaseBot is an under-development Javascript program that has been used to log chat messages in real-time from one or more twitch.tv livestream.

The logged messages are then added to a SQL database created also by the program. From here, the messages can be queryed and used for analytical purposes. 


## Usage/Examples

```javascript
client.on('message', (channel, tags, message, self) => 
{
  
  const chatMessage= message = message.replace(/'/g, "''");
  
  d = new Date().toLocaleString('en-us', { weekday:"long", year:"numeric", month:"short", day:"numeric"})
  
  userID = tags['user-id']; // ID of the user, used for the database.
  
  twitchName = tags['display-name']; // Name of the user, used for the database.
  
  subscriber = tags['subscriber']; // ID of the user, used for the database.
  
  randID = Math.floor(Math.random() * 10_000_000_000); // Random ID for the database.

  named_channel = channel.replace('#', '').toUpperCase(); // Name of the channel, without the #.

  if (tags['subscriber'] == '1') {
    console.log(`(${counter()})(${named_channel})(${tags['user-id']})(SUB) ${tags['display-name']}: ${chatMessage}`); // If the user is a subscriber, it will log that to the database.
    
  }
  else {
    console.log(`(${counter()})(${named_channel})(${tags['user-id']}) ${tags['display-name']}: ${chatMessage}`); // If the user is not a subscriber, it will log that to the database.
    
  }

  db.run(`INSERT INTO TwitchChatDatabase(FAKE_ID, TIMESTAMP, USER_ACCID, TWITCH_NAME, CHAT_MESSAGE, CHANNEL) VALUES(?, ?, ?, ?, ?, ?)`, [randID, d, userID, twitchName, chatMessage, named_channel], errorMessage); 
});
```

