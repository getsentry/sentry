-- Conditional sorted set member removal for a single key
-- Removes members from a sorted set only if their current score is <= the provided max_score
--
-- KEYS[1]: The sorted set key
-- ARGV: Pairs of member and max_score values
--       Format: [member1, max_score1, member2, max_score2, ...]
--
-- Returns: List of members that were actually removed

local key = KEYS[1]
local removed = {}

-- Process pairs of member and max_score
for i = 1, #ARGV, 2 do
    local member = ARGV[i]
    local max_score = tonumber(ARGV[i + 1])

    -- Get the current score of the member
    local current_score = redis.call('ZSCORE', key, member)

    -- If member exists and score is <= max_score, remove it
    if current_score and tonumber(current_score) <= max_score then
        redis.call('ZREM', key, member)
        table.insert(removed, member)
    end
end

return removed
