-- Add an element to a set and cap it to a certain size.
assert(#KEYS == 1, "provide exactly one set key")
assert(#ARGV == 3, "provide a value, max_size and a TTL")

local key = KEYS[1]
local value = ARGV[1]
local max_size = tonumber(ARGV[2])
local ttl = ARGV[3]

local inserted = redis.call("SADD", key, value)
if inserted then
    local current_size = redis.call("SCARD", key)
    local overflow = current_size - max_size
    if overflow > 0 then
        -- Evict random entries.
        -- NOTE: There is a chance that we remove the same element that we inserted.
        redis.call("SPOP", key, overflow)
    end
end

redis.call("EXPIRE", key, ttl)
