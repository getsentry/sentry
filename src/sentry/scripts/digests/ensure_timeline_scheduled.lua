-- Ensures a timeline is scheduled to be digested, adjusting the schedule time
-- if necessary.
-- KEYS: {WAITING, READY, LAST_PROCESSED_TIMESTAMP}
-- ARGV: {
--  TIMELINE,   -- timeline key
--  TIMESTAMP,  --
--  INCREMENT,  -- amount of time (in seconds) that an event addition delays
--              -- scheduling
--  MAXIMUM     -- maximum amount of time (in seconds) between a timeline
--              -- being digested, and the same timeline being scheduled for
--              -- the next digestion
-- }
local WAITING = KEYS[1] or error("incorrect number of keys provided")
local READY = KEYS[2] or error("incorrect number of keys provided")
local LAST_PROCESSED_TIMESTAMP = KEYS[3] or error("incorrect number of keys provided")

local TIMELINE = ARGV[1] or error("incorrect number of arguments provided")
local TIMESTAMP = ARGV[2] or error("incorrect number of arguments provided")
local INCREMENT = ARGV[3] or error("incorrect number of arguments provided")
local MAXIMUM = ARGV[4] or error("incorrect number of arguments provided")

-- If the timeline is already in the "ready" set, this is a noop.
if tonumber(redis.call('ZSCORE', READY, TIMELINE)) ~= nil then
    return false
end

-- Otherwise, check to see if the timeline is in the "waiting" set.
local score = tonumber(redis.call('ZSCORE', WAITING, TIMELINE))
if score ~= nil then
    -- If the timeline is already in the "waiting" set, increase the delay by
    -- min(current schedule + increment value, maximum delay after last processing time).
    local last = tonumber(redis.call('GET', LAST_PROCESSED_TIMESTAMP))
    local update = nil;
    if last == nil then
        -- If the last processed timestamp is missing for some reason (possibly
        -- evicted), be conservative and allow the timeline to be scheduled
        -- with either the current schedule time or provided timestamp,
        -- whichever is smaller.
        update = math.min(score, TIMESTAMP)
    else
        update = math.min(
            score + tonumber(INCREMENT),
            last + tonumber(MAXIMUM)
        )
    end

    if update ~= score then
        redis.call('ZADD', WAITING, update, TIMELINE)
    end
    return false
end

-- If the timeline isn't already in either set, add it to the "ready" set with
-- the provided timestamp. This allows for immediate scheduling, bypassing the
-- imposed delay of the "waiting" state.
redis.call('ZADD', READY, TIMESTAMP, TIMELINE)
return true
