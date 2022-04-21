-- TODO: This is currently just the concurrent rate limiter however this should subsume the fixed
-- window rate limiter (at least for the API level) as well to reduce the redis roundtrips
--
-- The concurrent rate limiter stores all currently executing requests in a redis
-- sorted set. It can be thought of in the following way:
--
-- at any point in time there are <concurrent_limit> amount of slots for a specific key.
-- every executing is stored with a string uid (for id lookups) and the timestamp as the score (for sorting)
--
-- Input:
-- keys:
--  redis_key,
-- args:
--  concurrent_limit, request_uid, current_time, max_tll_seconds
--
-- Output:
-- current_executions (including the one that was just added), request_allowed?, cleaned_up_requests
local key = KEYS[1]

-- The maximum amount of concurrent requests for the given key
local concurrent_limit = tonumber(ARGV[1])
-- a unique id associated with the request. We need this to be able to remove a specific request
-- from the currently executing requests once it finishes (finishing the request is not done
-- by this script)
local request_uid = ARGV[2]
-- current time according to the application server. To understand why we pass this,
-- read https://github.blog/2021-04-05-how-we-scaled-github-api-sharded-replicated-rate-limiter-redis/
local cur_time = tonumber(ARGV[3])
-- the maximum time a request can be alive on the backend server. If the timestamp of a request is
-- at least this old that means either something went wrong with the request and it never finished
-- or the server timed it out
local max_tll_seconds = tonumber(ARGV[4])

-- NOTE (Volo): this is only for debug purposes and should be taken out by 2022-04-01
-- this is trying to figure out how many stale requests were cleaned up to make sure
-- that the rate limiter is working correctly
local current_executions_pre_cleanup = redis.call("zcard", key)

-- first we remove all the requests whose scores (i.e. their timestamps) are older than the now - max ttl
-- this prevents us from overcounting concurrent requests
redis.call("zremrangebyscore", key, "-inf", cur_time - max_tll_seconds)
-- get the size of the set, which tells us how many requests are currently executing
local current_executions = redis.call("zcard", key)
local allowed = current_executions < concurrent_limit
local cleaned_up_requests = current_executions_pre_cleanup - current_executions

if allowed then
  -- if below the limit, add to the set
  redis.call("zadd", key, cur_time, request_uid)
  -- a lua script executes atomically and only one element was added to the set
  -- hence we can safely say that the amount of current executions is one higher
  -- than it was before
  current_executions = current_executions + 1
end

-- NOTE: the cleaned up execution number should be removed once we know the rate limiter
-- is working correctly
return { current_executions, allowed, cleaned_up_requests}
