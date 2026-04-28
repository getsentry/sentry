-- Conditionally delete segment metadata only if the ingested count hasn't changed.
-- This is atomic with add-buffer.lua on the same {project_id:trace_id} slot,
-- preventing data loss when process_spans adds new spans between flush and cleanup.
--
-- Returns 1 if data was deleted, 0 if ingested count changed (new spans arrived).
--
-- KEYS[1] = segment_key (e.g., span-buf:s:{project_id:trace_id}:span_id)
-- ARGV[1] = expected ingested count at flush time

local segment_key = KEYS[1]
local expected_ic = tonumber(ARGV[1])

local ic_key = "span-buf:ic:" .. segment_key
local ic = redis.call("GET", ic_key)

if ic and tonumber(ic) == expected_ic then
    redis.call("DEL", "span-buf:hrs:" .. segment_key)
    redis.call("DEL", ic_key)
    redis.call("DEL", "span-buf:ibc:" .. segment_key)
    return 1
end

return 0
