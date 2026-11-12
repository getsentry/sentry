-- Keeps a stale escalation threshold, or replaces it with a threshold of 0.
--
-- This script replaces a WATCH and MULTI block.
--
-- KEYS[1]: the threshold key
-- ARGV[1]: "1" if the caller has a stale threshold, "0" if it does not
-- ARGV[2]: the TTL in seconds for a threshold of 0
--
-- Returns the remaining TTL of the stale threshold if the script keeps it.
-- Returns 0 if the script writes a threshold of 0.

assert(#KEYS == 1, "provide exactly one threshold key")

local key = KEYS[1]
local has_stale_threshold = ARGV[1] == "1"
local fallback_ttl = tonumber(ARGV[2])

local existing_ttl = redis.call("TTL", key)
if has_stale_threshold and existing_ttl > 0 then
    return existing_ttl
end

redis.call("SET", key, "0", "EX", fallback_ttl)
return 0
