-- Empty one list and append its items to another, in one step.
-- KEYS[1]: the list to drain. KEYS[2]: the list to append to.
-- ARGV[1]: TTL in seconds for KEYS[2].
-- Returns the drained items. On redis-cluster both keys must share a hash slot.
assert(#KEYS == 2, "provide the list to drain and the list to append to")

local items = redis.call("LRANGE", KEYS[1], 0, -1)
if #items > 0 then
    for _, item in ipairs(items) do
        redis.call("RPUSH", KEYS[2], item)
    end
    redis.call("EXPIRE", KEYS[2], ARGV[1])
    redis.call("DEL", KEYS[1])
end
return items
