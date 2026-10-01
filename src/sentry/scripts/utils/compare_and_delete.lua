-- Delete a key only if it still holds the expected value.
assert(#KEYS == 1, "provide exactly one key")
assert(#ARGV == 1, "provide the expected value")

local key = KEYS[1]
if redis.call("GET", key) == ARGV[1] then
    return redis.call("DEL", key)
end
return 0
