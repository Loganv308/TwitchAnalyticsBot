import axios from "axios"; // Axios module (HTTP requests)

import { getOAuthToken } from "./auth.js";
import { incrementUp } from "./utils.js";

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

  const apiUrl = 'https://api.twitch.tv/helix/streams';
  
  const queryParams = channels.map((channel) => `user_login=${channel}`).join('&');
  const token = await getOAuthToken();
  
  try {
    const response = await fetch(`${apiUrl}?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-ID": process.env.CLIENT_ID,
      }
    })

    // If the response from the Twitch API 
    if (!response.ok) {
      throw new Error(`Twitch API request failed: ${response.statusText}`);
    }

    // Parse the JSON response
    const data = await response.json();

    console.log(data);

    // Returns a map of main stream data such as Username, Title, viewer_count, etc. 
    return data.data.map((stream) => ({  
      id: stream.id,
      title: stream.title,
      game_name: stream.game_name,
      started_at: stream.started_at,
      viewer_count: stream.viewer_count,
      user_id: stream.user_id,
      thumbnail_url: stream.thumbnail_url,
      user_name: stream.user_login
    }));
  } catch (error) {
    console.error('Error fetching stream data:', error);
    return [];
  }
}

// This method returns 2 array lists, all live channels, and all offline channels. 
// If there are no channels in the list, it will return 2 empty arrays. 
export async function offlineOnlineStreams(channels) 
{
  if (!channels || channels.length === 0) {
    return { live: [], offline: [] };
  } else {
      try {
        // Fetch live stream data
        const liveChannels = await getStreamData(channels);
    
        // Map live channel names for comparison
        const liveChannelNames = liveChannels.map((stream) => stream.user_name.toLowerCase());
    
        // Filter offline channels
        const offlineChannels = channels.filter(
          (channel) => !liveChannelNames.includes(channel.toLowerCase())
        );
    
        return {
          live: liveChannels,
          offline: offlineChannels,
        };
      } catch (error) {
      console.error('Error fetching stream data:', error)
      throw error;
    }
  }
}

export default {
    getTopChannels,
    getStreamData,
    offlineOnlineStreams,
}