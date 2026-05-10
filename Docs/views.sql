-- Extend your existing MV or create a new one
CREATE MATERIALIZED VIEW channel_stats_mv AS
SELECT
    c.name AS channel,
    COUNT(*) AS total_messages,
    COUNT(DISTINCT m.username) AS unique_chatters,
    COUNT(*) FILTER (WHERE m.subscriber) AS sub_messages,
    COUNT(*) FILTER (WHERE NOT m.subscriber) AS non_sub_messages,
    ROUND(
        COUNT(*) FILTER (WHERE m.subscriber)::numeric
        / NULLIF(COUNT(*), 0) * 100,
        2
    ) AS sub_pct
FROM messages m
JOIN channels c ON m.channel_id = c.id
GROUP BY c.name;

-- Separate MV for top chatters (per channel)
CREATE MATERIALIZED VIEW top_chatters_mv AS
SELECT
    c.name AS channel,
    m.username,
    COUNT(*) AS message_count,
    RANK() OVER (PARTITION BY c.name ORDER BY COUNT(*) DESC) AS rnk
FROM messages m
JOIN channels c ON m.channel_id = c.id
GROUP BY c.name, m.username;

CREATE INDEX ON top_chatters_mv(channel, rnk);