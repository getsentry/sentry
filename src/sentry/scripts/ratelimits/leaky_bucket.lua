-- metering implementation of leaky bucket (O(1) complexity space and time complexity)
--
-- Input:
-- keys:
--   * redis_key (key to store the bucket state, should be unique per rate limit)
-- args:
--   * bucket_size (limit of drops in the bucket, effecitvely the max burst limit),
--   * drip_rate (number of drops leaking per second, effectively the sustained rate limit),
--   * current_time (current time according to the application server)
--        ^^^ to understand why we pass this,
--            read https://github.blog/2021-04-05-how-we-scaled-github-api-sharded-replicated-rate-limiter-redis/
--   * incr_by (optional, number of drops to add to the bucket, default is 1)
--
-- Output:
--   * bucket_size (limit of drops in the bucket, effecitvely the max burst limit),
--   * drip_rate (number of drops leaking per second, effectively the sustained rate limit),
--   * last_drip (the last time we allowed a request),
--   * current_level (the current water level in the bucket),
--   * wait_time (time in seconds to wait before the next request can be allowed
--                0 indicates that the request can be allowed immediately)
--
-- Key is a hash with schema:
--   * current_level: the current water level in the bucket
--   * last_drip: the last time we allowed a request
--



local key = KEYS[1]
local bucket_size = tonumber(ARGV[1])
local drip_rate = tonumber(ARGV[2])
local current_time = tonumber(ARGV[3])
local incr_by = tonumber(ARGV[4] or 1)  -- default to 1 if not provided

-- maximum time to live for the key in seconds, adding 2 seconds to account for any clock drift
-- if it's not accessed in that time, the bucket is guaranteed to be empty, so we can expire it
local max_tll_seconds = math.ceil(bucket_size / drip_rate) + 2

-- time of the last drip, as in last time we allowed a request
local last_drip = redis.call("hget", key, "last_drip")

if last_drip == false then
  last_drip = current_time
else
  last_drip = tonumber(last_drip)
  -- to prevent time going backwards
  current_time = math.max(current_time, last_drip)
end

-- level of "water" in the bucket at the last drip, as in how many requests we allowed
local current_level = redis.call("hget", key, "current_level")

if current_level == false then
  current_level = 0
else
  current_level = tonumber(current_level)
end


-- time elapsed since the last drip, in seconds
local elapsed_time = current_time - last_drip
-- bucket cannot be less than empty + we need to increase to the level to account for the new request
local new_level = math.max(0, current_level - elapsed_time * drip_rate) + incr_by
-- check it the current request would overflow the bucket
local allowed = new_level <= bucket_size

local wait_time = tostring((new_level - bucket_size) / drip_rate)

if allowed then
  redis.call("hset", key, "current_level", new_level)
  redis.call("hset", key, "last_drip", current_time)
  redis.call("expire", key, max_tll_seconds)
  wait_time = 0
end

-- Redis converts all numerical return values from Lua to ints,
-- so we need to convert floats to strings, then back to floats in Python
return { bucket_size, drip_rate, tostring(last_drip), tostring(current_level), wait_time}
