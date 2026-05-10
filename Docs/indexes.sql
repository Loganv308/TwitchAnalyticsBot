CREATE INDEX idx_messages_channel_id
ON messages(channel_id);

CREATE INDEX idx_messages_timestamp
ON messages(timestamp DESC);

CREATE INDEX idx_messages_stream_id
ON messages(stream_id);

CREATE INDEX idx_messages_username
ON messages(username);

CREATE INDEX idx_channels_name
ON channels(name);

CREATE INDEX idx_messages_channel_timestamp
ON messages(channel_id, timestamp DESC);

CREATE INDEX idx_messages_channel_username
ON messages(channel_id, username);

CREATE INDEX idx_messages_subscriber
ON messages(subscriber);

CREATE INDEX idx_messages_recent
ON messages(channel_id, timestamp DESC)
WHERE timestamp >= NOW() - INTERVAL '7 days';

CREATE UNIQUE INDEX ON channel_stats_mv(channel);
CREATE UNIQUE INDEX ON top_chatters_mv(channel, username);