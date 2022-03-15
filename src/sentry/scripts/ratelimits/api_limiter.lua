-- TODO: This is currently just the concurrent rate limiter however this should subsume the fixed
-- window rate limiter (at least for the API level) as well to reduce the redis roundtrips
--
-- Input:
-- keys:
--  redis_key,
-- args:
--  concurrent_limit, request_uid, current_time, max_tll_seconds
--
-- Output:
-- current_executions (including the one that was just added), request_allowed?
local key = KEYS[1]

local concurrent_limit = tonumber(ARGV[1])
local request_uid = ARGV[2]
local cur_time = tonumber(ARGV[3])
local max_tll_seconds = tonumber(ARGV[4])
redis.call("zremrangebyscore", key, "-inf", cur_time - max_tll_seconds)
local current_executions = redis.call("zcard", key)
local allowed = current_executions < concurrent_limit

if allowed then
  redis.call("zadd", key, cur_time, request_uid)
  current_executions = current_executions + 1
end

return { current_executions, allowed}
