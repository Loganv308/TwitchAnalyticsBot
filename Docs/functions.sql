CREATE OR REPLACE FUNCTION public.get_channel_stats()
 RETURNS TABLE(channel text, total_messages bigint, unique_chatters bigint, sub_messages bigint, non_sub_messages bigint, sub_pct numeric)
 LANGUAGE sql
AS $function$
    SELECT channel, total_messages, unique_chatters, sub_messages, non_sub_messages, sub_pct
    FROM channel_stats_mv;
$function$;

CREATE OR REPLACE FUNCTION public.get_messages_per_minute(channel_name text)
 RETURNS TABLE(minute text, count bigint)
 LANGUAGE sql
AS $function$
  SELECT
    to_char(date_trunc('minute', timestamp), 'YYYY-MM-DD"T"HH24:MI') AS minute,
    COUNT(*) AS count
  FROM messages m
  JOIN channels c ON m.channel_id = c.id
  WHERE c.name = channel_name
    AND timestamp >= NOW() - INTERVAL '30 minutes'
  GROUP BY date_trunc('minute', timestamp)
  ORDER BY date_trunc('minute', timestamp) ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_subscriber_ratio(channel_name text)
RETURNS TABLE(sub_messages bigint, non_sub_messages bigint, total bigint)
LANGUAGE sql AS $function$
    SELECT sub_messages, non_sub_messages, total_messages AS total
    FROM channel_stats_mv
    WHERE channel = channel_name;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_chatters(channel_name text, lim integer DEFAULT 10)
RETURNS TABLE(username text, message_count bigint)
LANGUAGE sql AS $function$
    SELECT username::text, message_count::bigint
    FROM top_chatters_mv
    WHERE channel = channel_name AND rnk <= lim
    ORDER BY rnk;
$function$;