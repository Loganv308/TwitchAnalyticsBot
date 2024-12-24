import axios from "axios"; // Axios module (HTTP requests)

import { getOAuthToken } from "./auth";

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

export default {
    getTopChannels
}