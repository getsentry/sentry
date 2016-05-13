local key = KEYS[1]
local uuid = ARGV[1]

local value = redis.call('GET', key)
if not value then
    return redis.error_reply('key does not exist')
elseif value ~= uuid then
    return redis.error_reply('key was set by different manager')
else
    redis.call('DEL', key)
    return true
end
