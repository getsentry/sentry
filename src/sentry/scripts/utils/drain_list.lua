assert(#KEYS == 1, "provide exactly one list key")

local key = KEYS[1]
local items = redis.call("LRANGE", key, 0, -1)
redis.call("DEL", key)
return items
