-- Save progress only while this worker still owns the operation lease.
local lease_key = KEYS[1]
local checkpoint_key = KEYS[2]
local worker_token = ARGV[1]
local checkpoint = ARGV[2]
local ttl = ARGV[3]

if redis.call("GET", lease_key) ~= worker_token then
    return 0
end

redis.call("SET", checkpoint_key, checkpoint, "EX", ttl)
return 1
