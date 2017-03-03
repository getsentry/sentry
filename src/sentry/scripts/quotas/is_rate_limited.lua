-- Check a collection of quota counters to identify if an item should be rate
-- limited. Values provided as ``KEYS`` specify the keys of the counters to
-- check, and values provided as ``ARGV`` specify the maximum value (quota
-- limit) and expiration time for each key.
--
-- For example, to check a quota ``foo`` that has a limit of 10 items and
-- expires at the Unix timestamp ``100``, as well as a quota ``bar`` that has a
-- limit of 20 items and should expire at the Unix timestamp ``100``, the
-- ``KEYS`` and ``ARGV`` values would be as follows:
--
--   KEYS = {"foo", "bar"}
--   ARGV = {10, 100, 20, 100}
--
-- If all checks pass (the item is accepted), the counters for all quotas are
-- incremented. If any checks fail (the item is rejected), the counters for all
-- quotas are unaffected. The result is a Lua table/array (Redis multi bulk
-- reply) that specifies whether or not the item was *rejected* based on the
-- provided limit.
assert(#KEYS * 2 == #ARGV, "incorrect number of keys and arguments provided")

local results = {}
local failed = false
for i=1,#KEYS do
    local limit = tonumber(ARGV[(i * 2) - 1])
    local rejected = (redis.call('GET', KEYS[i]) or 0) + 1 > limit
    if rejected then
        failed = true
    end
    results[i] = rejected
end

if not failed then
    for i=1,#KEYS do
        redis.call('INCR', KEYS[i])
        redis.call('EXPIREAT', KEYS[i], ARGV[i * 2])
    end
end

return results
