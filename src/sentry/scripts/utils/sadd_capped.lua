-- Remove elements from a set until it is < max_size, then add an element.
assert(#KEYS == 1, "provide exactly one set key")
assert(#ARGV == 2, "provide a value and a max_size")

local key = KEYS[1]
local value = ARGV[1]
local max_size = tonumber(ARGV[2])

print(key)
print(value)
print(max_size)

local inserted = redis.call("SADD", key, value)
if inserted then
    local current_size = redis.call("SCARD", key)
    while current_size > max_size do
        -- Evict random entry.
        -- NOTE: There is a chance that we remove the same element that we inserted.
        redis.call("SPOP", key)
        current_size = current_size - 1
    end
    return current_size
end

return nil
