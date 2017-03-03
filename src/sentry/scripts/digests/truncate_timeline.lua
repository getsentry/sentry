-- Trims a timeline to a maximum number of records.
-- Returns the number of keys that were deleted.
-- KEYS: {TIMELINE}
-- ARGV: {LIMIT, PREFIX}
local keys = redis.call('ZREVRANGE', KEYS[1], ARGV[1], -1)
local prefix = ARGV[2]
local separator = ARGV[3]
for i, record in pairs(keys) do
    redis.call('DEL', prefix .. ':r:' .. record)
    redis.call('ZREM', KEYS[1], record)
end
return table.getn(keys)
