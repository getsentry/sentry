local key = KEYS[1]
local uuid = ARGV[1]

local value = redis.call('GET', key)
if not value then
    return redis.error_reply(string.format("No lock at key exists at key: %s", key))
elseif value ~= uuid then
    return redis.error_reply(string.format("Lock at %s was set by %s, and cannot be released by %s.", key, value, uuid))
else
    redis.call('DEL', key)
    return redis.status_reply("OK")
end
