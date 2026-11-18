-- Read several lists in one step, so no write lands between the reads.
-- KEYS: the lists to read.
-- Returns each list's items, in KEYS order. On redis-cluster all keys must share a hash slot.
assert(#KEYS >= 1, "provide at least one list to read")

local lists = {}
for i, key in ipairs(KEYS) do
    lists[i] = redis.call("LRANGE", key, 0, -1)
end
return lists
