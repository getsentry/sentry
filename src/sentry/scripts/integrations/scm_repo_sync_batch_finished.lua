local key = KEYS[1]
local ttl = ARGV[1]

if tonumber(redis.call('HGET', key, 'batches_left') or '0') > 0 then
    redis.call('HINCRBY', key, 'batches_left', -1)
    redis.call('EXPIRE', key, ttl)
end
