local members = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[3])
for _, member in ipairs(members) do
    redis.call('ZADD', KEYS[1], ARGV[2], member)
end
return members
