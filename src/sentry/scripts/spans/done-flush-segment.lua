-- Conditionally remove a segment from the queue only if its score hasn't changed.
-- If the score changed, new spans arrived and cleanup should be skipped.
-- Returns 1 if removed, 0 if score changed (new spans arrived).
--
-- KEYS[1] = queue_key
-- ARGV[1] = segment_key (member of the sorted set)
-- ARGV[2] = expected_score (the score captured during flush_segments)

local score = redis.call("ZSCORE", KEYS[1], ARGV[1])
if score and tonumber(score) == tonumber(ARGV[2]) then
    redis.call("ZREM", KEYS[1], ARGV[1])
    return 1
end
return 0
