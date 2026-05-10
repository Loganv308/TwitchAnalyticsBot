-- Refresh on a schedule using pg_cron (if available):
SELECT cron.schedule('refresh-channel-stats', '*/5 * * * *', 
    'REFRESH MATERIALIZED VIEW CONCURRENTLY channel_stats_mv');

SELECT cron.schedule('refresh-top-chatters', '*/10 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY top_chatters_mv');