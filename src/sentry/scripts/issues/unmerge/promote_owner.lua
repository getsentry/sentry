if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[3] then
    return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[4])
return 1
