export const MODULE_DURATION_QUERY = `SELECT
 toStartOfInterval(start_timestamp, INTERVAL 12 HOUR) as interval,
 module,
 quantile(0.75)(exclusive_time) as p75
 FROM spans_experimental_starfish
 WHERE module in ['http', 'db', 'cache']
 GROUP BY interval, module
 ORDER BY interval asc
 `;
