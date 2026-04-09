# TwitchAnalyticsBot

A real-time Twitch chat analytics platform that logs messages from live streams into a queryable SQLite database, with a live dashboard for monitoring chat activity across multiple channels simultaneously.

## Overview

TwitchAnalyticsBot connects to one or more Twitch channels via the Twitch API and TMI.js, recording every chat message along with metadata such as subscriber status, timestamps, and stream context. A built-in Express API exposes this data to a live web dashboard that updates every 5 seconds.

Originally started around 2021 as a simple message logger, the project has since been significantly refactored and expanded. Active development resumed in late 2024 with a focus on reliability, analytics, and a real-time UI.

## Features

- Real-time chat logging across multiple Twitch channels
- Per-channel SQLite databases with stream and message history
- Live web dashboard showing viewer counts, messages per minute, top chatters, and subscriber ratios
- REST API for querying chat data and stream statistics
- Automatic stream metadata fetching via the Twitch Helix API

## Tech Stack

- **Runtime:** Node.js
- **Chat:** TMI.js
- **API:** Express.js + Twitch Helix API
- **Database:** SQLite (via `sqlite` + `sqlite3`)
- **Dashboard:** Vanilla JS + Chart.js

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the project root:
   ```
   CLIENT_ID=your_twitch_client_id
   CLIENT_SECRET=your_twitch_client_secret
   ```
4. Start the bot and API server:
   ```bash
   npm start
   ```
5. Open the dashboard at `http://localhost:3001/dashboard.html`

## Project Status

Actively maintained and in development. Contributions are welcome — feel free to open an issue or submit a pull request.
