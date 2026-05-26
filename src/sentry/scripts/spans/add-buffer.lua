--[[

Adds a batch of Spans (Subsegments) to their Segment.
Docs about the data model can be found in the README.md file in the `spans` module.

The goal of this script is to recompose Segments (trees of spans) from subsegments of spans
that can come in any order. Each span only has knowledge of its parent. The root
span for a segment knows it is the root most of the time.

As spans can arrive in any order, this script has to assemble subtrees with the
knowledge available, then merge them into the same segment when the common parent
is received.

This implies that it has to operate according to these steps:

1. Identify the highest level known span for a subsegment.
2. Update the member-keys index and counters when a common parent is found.
3. Update the redirect set to reflect the current state of the tree.


KEYS:
- "project_id:trace_id" -- just for redis-cluster routing, all keys that the script uses are sharded like this/have this hashtag.

ARGS:
- num_spans -- int -- Number of spans in the subsegment.
- parent_span_id -- str -- The parent span id of the root of the subsegment.
- has_root_span -- "true" or "false" -- Whether the subsegment contains the root of the segment.
- set_timeout -- int
- byte_count -- int -- The total number of bytes in the subsegment.
- max_segment_bytes -- int -- Maximum allowed ingested bytes for a segment. 0 means no limit.
- salt -- str -- Unique identifier for this subsegment. When the segment exceeds max_segment_bytes, this subsegment
                 is detached into its own segment keyed by salt.
- check_flush_lock -- "true" or "false" -- When true, this script checks for the per-segment flush lock and detaches
                                           the subsegment if the target segment is currently being flushed.
- *span_id -- str[] -- The span ids in the subsegment.

RETURNS:
- set_key -- str -- The key of the segment, used to look up member-keys index and identify the segment in the queue.
- has_root_span -- bool -- Whether this segment contains a root span.
- latency_ms -- number -- Milliseconds elapsed during script execution.
- latency_table -- table -- Per-step latency measurements.
- metrics_table -- table -- Per-step gauge metrics.

]]--

local project_and_trace = KEYS[1]

-- Lua's unpack() has a stack limit (typically ~7998 elements in Lua 5.1).
-- When merging member-keys sets that have accumulated across many EVALSHA calls,
-- we use SSCAN to stream members in batches to avoid both memory issues from
-- large smembers results and "too many results to unpack" errors.
local SCAN_BATCH_SIZE = 1000

local function merge_set(source_key, dest_key)
    local cursor = "0"
    repeat
        local result = redis.call("sscan", source_key, cursor, "COUNT", SCAN_BATCH_SIZE)
        cursor = result[1]
        local members = result[2]
        if #members > 0 then
            -- we do not use SUNIONSTORE here because we assume the target set
            -- at dest_key can be massive. if it is, SUNIONSTORE will copy the
            -- entire target set again, which appears to be _worse_ than
            -- copying the source set into lua memory and out again.
            redis.call("sadd", dest_key, unpack(members))
        end
    until cursor == "0"
end

local num_spans = ARGV[1]
local parent_span_id = ARGV[2]
local has_root_span = ARGV[3] == "true"
local set_timeout = tonumber(ARGV[4])
local byte_count = tonumber(ARGV[5])
local max_segment_bytes = tonumber(ARGV[6])
local salt = ARGV[7] or ""
local check_flush_lock = ARGV[8] == "true"
local NUM_ARGS = 8

local function get_time_ms()
    local time = redis.call("TIME")
    return tonumber(time[1]) * 1000 + tonumber(time[2]) / 1000
end

-- Capture start time for latency measurement
local start_time_ms = get_time_ms()

local set_span_id = parent_span_id
local redirect_depth = 0

local main_redirect_key = string.format("span-buf:ssr:{%s}", project_and_trace)

-- Navigates the tree up to the highest level parent span we can find. Such
-- span is needed to know the segment we need to merge the subsegment into.
for i = 0, 100 do -- Theoretic maximum depth of redirects is 100
    local new_set_span = redis.call("hget", main_redirect_key, set_span_id)
    redirect_depth = i
    if not new_set_span or new_set_span == set_span_id then
        break
    end

    set_span_id = new_set_span
end

local latency_table = {}
local metrics_table = {}
table.insert(metrics_table, {"redirect_table_size", redis.call("hlen", main_redirect_key)})
table.insert(metrics_table, {"redirect_depth", redirect_depth})
local set_key = string.format("span-buf:s:{%s}:%s", project_and_trace, set_span_id)

-- Reset the set expiry as we saw a new subsegment for this set
local has_root_span_key = string.format("span-buf:hrs:%s", set_key)
has_root_span = has_root_span or redis.call("get", has_root_span_key) == "1"
if has_root_span then
    redis.call("setex", has_root_span_key, set_timeout, "1")
end

local hset_args = {}

for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]

    table.insert(hset_args, span_id)
    table.insert(hset_args, set_span_id)
end

redis.call("hset", main_redirect_key, unpack(hset_args))
redis.call("expire", main_redirect_key, set_timeout)

local redirect_end_time_ms = get_time_ms()
table.insert(latency_table, {"redirect_step_latency_ms", redirect_end_time_ms - start_time_ms})

local ingested_byte_count_key = string.format("span-buf:ibc:%s", set_key)
local ingested_byte_count = tonumber(redis.call("get", ingested_byte_count_key) or 0)

for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]
    if span_id ~= parent_span_id then
        local child_set_key = string.format("span-buf:s:{%s}:%s", project_and_trace, span_id)
        local child_ibc_key = string.format("span-buf:ibc:%s", child_set_key)
        local child_ibc = tonumber(redis.call("get", child_ibc_key) or 0)
        byte_count = byte_count + child_ibc
    end
end

-- Detach this subsegment into a new segment if either:
--   1. The target segment is already over the byte limit. Without this,
--      segments would grow unboundedly past max_segment_bytes.
--   2. The target segment is currently being flushed (lock held). If we keep
--      writing to a segment while it is being flushed, conditional cleanup
--      in `done-flush-segment` will skip, and we can end up flushing
--      duplicate spans in the next cycle while leaving segments accumulating
--      in Redis without their data being cleaned up.
local segment_too_large = max_segment_bytes > 0 and tonumber(ingested_byte_count) + byte_count > max_segment_bytes
local segment_locked = false
if check_flush_lock then
    local flush_lock_key = string.format("span-buf:fl:%s", set_key)
    segment_locked = redis.call("exists", flush_lock_key) == 1
end
if segment_too_large or segment_locked then
    set_span_id = salt
    set_key = string.format("span-buf:s:{%s}:%s", project_and_trace, salt)
    ingested_byte_count_key = string.format("span-buf:ibc:%s", set_key)
end
table.insert(metrics_table, {"detached_segment_too_large", segment_too_large and 1 or 0})
table.insert(metrics_table, {"detached_segment_locked", segment_locked and 1 or 0})

local ingested_count_key = string.format("span-buf:ic:%s", set_key)
local members_key = string.format("span-buf:mk:{%s}:%s", project_and_trace, set_span_id)

for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]
    if span_id ~= parent_span_id then
        local child_set_key = string.format("span-buf:s:{%s}:%s", project_and_trace, span_id)

        local child_ic_key = string.format("span-buf:ic:%s", child_set_key)
        local child_ic = redis.call("get", child_ic_key)
        if child_ic then
            redis.call("incrby", ingested_count_key, child_ic)
            redis.call("del", child_ic_key)
        end

        local child_ibc_key = string.format("span-buf:ibc:%s", child_set_key)
        local child_ibc = redis.call("get", child_ibc_key)
        if child_ibc then
            -- byte_count already holds the child's byte count, so we don't need to add again
            redis.call("del", child_ibc_key)
        end

        local child_members_key = string.format("span-buf:mk:{%s}:%s", project_and_trace, span_id)
        if redis.call("exists", child_members_key) == 1 then
            merge_set(child_members_key, members_key)
            redis.call("del", child_members_key)
        end
    end
end

local merge_payload_keys_end_time_ms = get_time_ms()
table.insert(latency_table, {"merge_payload_keys_step_latency_ms", merge_payload_keys_end_time_ms - redirect_end_time_ms})

redis.call("sadd", members_key, salt)
redis.call("expire", members_key, set_timeout)

-- Track total number of spans ingested for this segment
redis.call("incrby", ingested_count_key, num_spans)
redis.call("incrby", ingested_byte_count_key, byte_count)
redis.call("expire", ingested_count_key, set_timeout)
redis.call("expire", ingested_byte_count_key, set_timeout)

local counter_merge_end_time_ms = get_time_ms()
table.insert(latency_table, {"counter_merge_step_latency_ms", counter_merge_end_time_ms - merge_payload_keys_end_time_ms})

-- Capture end time and calculate latency in milliseconds
local end_time_ms = get_time_ms()
local latency_ms = end_time_ms - start_time_ms
table.insert(latency_table, {"total_step_latency_ms", latency_ms})

return {set_key, has_root_span, latency_ms, latency_table, metrics_table}
