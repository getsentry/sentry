-- Replace an organization's evaluator state only if its stored minute is the one the
-- caller read. Returns 1 when the state was written and 0 when another writer won.
assert(#KEYS == 1, "provide exactly one key")
assert(#ARGV == 4, "provide the expected minute, the next minute, the checkpoint and a TTL")

local key = KEYS[1]
-- Empty when the caller read no state, so the write only succeeds if there still is none.
local expected_minute = ARGV[1]
local next_minute = ARGV[2]
local checkpoint = ARGV[3]
local ttl = ARGV[4]

local current = redis.call("HGET", key, "next_minute")
if expected_minute == "" then
    if current then
        return 0
    end
elseif current ~= expected_minute then
    return 0
end

redis.call("HSET", key, "next_minute", next_minute, "checkpoint", checkpoint)
redis.call("EXPIRE", key, ttl)
return 1
