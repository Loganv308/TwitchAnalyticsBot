import axios from "axios"; // Axios module (HTTP requests)

import { getOAuthToken } from "./auth.js";
import { incrementUp } from "./utils.js";
import { DatabaseUtil } from "./database.js";

export async function getTopChannels() {
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
      const channels = response.data.data;
      
      try {
        for (let x = 0; x < channels.length; x++) {
          //console.log(response.data.data[x].viewer_count);
          const viewerCount = channels[x].viewer_count;
          const userName = channels[x].user_name;
          
          console.log(
            "Top channel #:",
            incrementUp(),
            userName,
            "with",
            viewerCount,
            "viewers"
          );
        }
      } catch (err) {
        console.log(err);
      }

      return channels;
    })
    .catch((error) => {
      console.log(error);
    });
}

export async function getStreamData(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new Error('A non-empty array of channel names is required.');
  }

  const token = await getOAuthToken();
  
  try {
    const response = await axios.get("https://api.twitch.tv/helix/streams", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": process.env.CLIENT_ID,
      },
      params: {
        user_login: channels, // Pass the list of channel names
      },
    })
    return response.data.data; // Return the array of live streams
  } catch (error) {
    console.error('Error fetching stream data:', error);
    throw error;
  }
}
    
export async function offlineOnlineStreams(channels) 
{
  try {
      const liveChannels = await getStreamData(channels);
      const liveChannelNames = liveChannels.map((stream) => stream.user_name.toLowerCase());

      // Check for offline channels
      const offlineChannels = channels.filter(
        (channel) => !liveChannelNames.includes(channel.toLowerCase())
      );

        for (const stream of liveChannelNames) {
          // Log live and offline channels
          if (liveChannels.length > 0) {
            liveChannels.forEach((stream) => {
              console.log(
                `LIVE: Channel: ${stream.user_name}, Viewers: ${stream.viewer_count}, Title: ${stream.title}`
              );
            });
          } else {
            console.log('No channels are currently live.');
          }

          if (offlineChannels.length > 0) {
            offlineChannels.forEach((channel) => {
              console.log(`OFFLINE: Channel: ${channel} is not live.`);
            });
          }

        return {
          live: liveChannels,
          offline: offlineChannels,
        };
      } 
    } catch (error) {
    console.error('Error fetching stream data:', error)
    throw error;
  }
}

export async function parseStreamData(channels) {
  
}

export default {
    getTopChannels,
    getStreamData,
    offlineOnlineStreams
}