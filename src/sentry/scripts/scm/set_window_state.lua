-- Record the service-provider's reported rate-limit window state, refusing to
-- regress to an older window or a lower usage count within the same window.
--
-- KEYS[1]: the window state key.
-- ARGV[1]: the reported usage count.
-- ARGV[2]: the epoch second at which the reported window resets.
-- ARGV[3]: the encoded window state to store.
-- ARGV[4]: the TTL of the window state key, in seconds.
--
-- Returns 1 if the state was written, 0 if the existing state was kept.
local used = tonumber(ARGV[1])
local reset = tonumber(ARGV[2])

local current = redis.call('GET', KEYS[1])
if current then
    local current_used, current_reset = string.match(current, "^(%-?%d+):(%-?%d+)")
    current_used = tonumber(current_used)
    current_reset = tonumber(current_reset)
    if current_used ~= nil and current_reset ~= nil then
        if current_reset > reset or (current_reset == reset and current_used >= used) then
            return 0
        end
    end
end

redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[4])
return 1
