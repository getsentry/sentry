-- Check a collection of quota counters to identify if an item should be rate
-- limited. Values provided as ``KEYS`` specify the keys of the counters to
-- check and the keys of counters to subtract, and values provided as ``ARGV``
-- specify the maximum value (quota limit) and expiration time for each key.
--
-- For example, to check a quota ``foo`` that has a corresponding refund/negative
-- counter "subtract_from_foo", a limit of 10 items and expires at the Unix timestamp
-- ``100``, as well as a quota ``bar`` that has a corresponding refund/negative
-- counter "subtract_from_bar" limit of 20 items and should expire at the Unix
-- timestamp ``100``, the ``KEYS`` and ``ARGV`` values would be as follows:
--
--   KEYS = {"foo", "subtract_from_foo", "bar", "subtract_from_bar"}
--   ARGV = {10, 100, 20, 100}
--
-- If all checks pass (the item is accepted), the counters for all quotas are
-- incremented. If any checks fail (the item is rejected), the counters for all
-- quotas are unaffected. The result is a Lua table/array (Redis multi bulk
-- reply) that specifies whether or not the item was *rejected* based on the
-- provided limit.
assert(#KEYS == #ARGV, "incorrect number of keys and arguments provided")
assert(#KEYS % 2 == 0, "there must be an even number of keys")

local results = {}
local failed = false
for i=1, #KEYS, 2 do
    local limit = tonumber(ARGV[i])
    local rejected = false
    -- limit=-1 means "no limit"
    if limit >= 0 then
        rejected = (redis.call('GET', KEYS[i]) or 0) - (redis.call('GET', KEYS[i + 1]) or 0) + 1 > limit
    end

    if rejected then
        failed = true
    end
    results[(i + 1) / 2] = rejected
end

if not failed then
    for i=1, #KEYS, 2 do
        redis.call('INCR', KEYS[i])
        redis.call('EXPIREAT', KEYS[i], ARGV[i + 1])
    end
end

return results
