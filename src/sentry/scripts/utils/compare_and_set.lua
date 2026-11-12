-- Set a key only if its current value is the value the caller read before.
-- Returns 1 when the key was set and 0 when the current value did not match.
assert(#KEYS == 1, "provide exactly one key")
assert(#ARGV == 4, "provide an expected flag, an expected value, a new value and a TTL")

local key = KEYS[1]
local expect_present = ARGV[1] == "1"
local expected = ARGV[2]
local value = ARGV[3]
local ttl = ARGV[4]

local current = redis.call("GET", key)
if expect_present then
    if current ~= expected then
        return 0
    end
elseif current then
    return 0
end

redis.call("SET", key, value, "EX", ttl)
return 1
