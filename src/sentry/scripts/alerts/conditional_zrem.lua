-- Conditional sorted set member removal for multiple keys in the same slot
-- Removes members from sorted sets only if their current score is <= the provided max_score
--
-- KEYS[1..N]: The sorted set keys (all must be in the same Redis cluster slot)
-- ARGV: Pairs of member and max_score values
--       Format: [member1, max_score1, member2, max_score2, ...]
--
-- Returns: Flat array of [key1, num_removed1, member1, member2, ..., key2, num_removed2, member3, ...]
--          This format is compatible with Redis Lua return value constraints

local results = {}

-- Process pairs of member and max_score for each key
for i = 1, #ARGV, 2 do
    local member = ARGV[i]
    local max_score = tonumber(ARGV[i + 1])

    -- Check and potentially remove from each key
    for j = 1, #KEYS do
        local key = KEYS[j]

        -- Get the current score of the member in this key
        local current_score = redis.call('ZSCORE', key, member)

        -- If member exists and score is <= max_score, remove it
        if current_score and tonumber(current_score) <= max_score then
            redis.call('ZREM', key, member)

            -- Store result as: key, member_removed
            table.insert(results, key)
            table.insert(results, member)
        end
    end
end

return results
