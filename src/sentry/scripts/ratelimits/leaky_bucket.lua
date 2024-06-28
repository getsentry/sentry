-- metering implementation of leaky bucket (O(1) complexity space and time complexity)
--
-- Input:
-- keys:
--  - redis_key (key to store the bucket state, should be unique per rate limit)
-- args:
--   - bucket_size (limit of drops in the bucket, effecitvely the max burst limit),
--   = drip_rate (number of drops leaking per second, effectively the sustained rate limit),
--
--   - current_time (current time according to the application server)
--        ^^^ to understand why we pass this,
--            read https://github.blog/2021-04-05-how-we-scaled-github-api-sharded-replicated-rate-limiter-redis/
--
-- Output:
--   - nil if allowed
--   - time to wait in seconds if not allowed
--
-- Key is a hash with schema:
-- - current_level: the current water level of the bucket
-- - last_drip: the last time we allowed a request


local key = KEYS[1]
local bucket_size = tonumber(ARGV[1])
local drip_rate = tonumber(ARGV[2])
local current_time = tonumber(ARGV[3])

-- maximum time to live for the key in seconds, adding 2 seconds to account for any clock drift
-- doesn't need to live any longer, because if it's not accessed in that time, it's guaranteed to be empty
local max_tll_seconds = math.ceil(bucket_size / drip_rate) + 2

-- time of the last drip, as in last time we allowed a request
local last_drip = redis.call("hget", key, "last_drip")

if last_drip == false then
  last_drip = current_time
else
  last_drip = tonumber(last_drip)
end

-- level of "water" in the bucket at the last drip, as in how many requests we allowed
local current_level = redis.call("hget", key, "current_level")

if current_level == false then
  current_level = 0
else
  current_level = tonumber(current_level)
end


local elapsed_time = current_time - last_drip
-- bucket cannot be less than empty + we need to add one to the level to account for the new drop
local new_level = math.max(0, current_level - elapsed_time * drip_rate) + 1
-- we need space for at least one new drop
local allowed = new_level <= bucket_size


if allowed then
  redis.call("hset", key, "current_level", new_level)
  redis.call("hset", key, "last_drip", current_time)
  redis.call("expire", key, max_tll_seconds)
  return nil
else
  local wait_time = (new_level - bucket_size) / drip_rate
  return wait_time
end
