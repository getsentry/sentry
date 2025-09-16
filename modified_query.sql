-- Modified query to show total count of group hashes per day
SELECT
    COUNT(DISTINCT id) as group_count,  -- Assuming 'id' is the group identifier/hash
    DATE(last_seen) as last_seen_date
FROM getsentry.sentry_groupedmessage
WHERE last_seen < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 95 DAY)
GROUP BY DATE(last_seen)
ORDER BY last_seen_date DESC;

-- Alternative version if the group hash field has a different name:
-- Replace 'id' with 'group_id', 'hash', or whatever field represents the group hash

-- If you want to see both total groups and status breakdown, use this version:
/*
SELECT
    COUNT(DISTINCT id) as total_groups,
    COUNT(*) as total_records,
    DATE(last_seen) as last_seen_date
FROM getsentry.sentry_groupedmessage
WHERE last_seen < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 95 DAY)
GROUP BY DATE(last_seen)
ORDER BY last_seen_date DESC;
*/
