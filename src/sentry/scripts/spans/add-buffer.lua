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
                 is detached into its own segment keyed by salt. Empty string disables this behavior.
- *span_id -- str[] -- The span ids in the subsegment.

RETURNS:
- set_key -- str -- The key of the segment, used to look up member-keys index and identify the segment in the queue.
- has_root_span -- bool -- Whether this segment contains a root span.
- latency_ms -- number -- Milliseconds elapsed during script execution.
- latency_table -- table -- Per-step latency measurements.
- metrics_table -- table -- Per-step gauge metrics.

]]--

local project_and_trace = KEYS[1]

local num_spans = ARGV[1]
local parent_span_id = ARGV[2]
local has_root_span = ARGV[3] == "true"
local set_timeout = tonumber(ARGV[4])
local byte_count = tonumber(ARGV[5])
local max_segment_bytes = tonumber(ARGV[6])
local salt = ARGV[7] or ""
local NUM_ARGS = 7

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

if salt ~= "" then
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

    -- If the segment is already too big, make this subsegment its own segment
    -- with salt as the identifier.
    if max_segment_bytes > 0 and tonumber(ingested_byte_count) + byte_count > max_segment_bytes then
        set_span_id = salt
        set_key = string.format("span-buf:s:{%s}:%s", project_and_trace, salt)
        ingested_byte_count_key = string.format("span-buf:ibc:%s", set_key)
    end

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
            local child_members = redis.call("smembers", child_members_key)
            if #child_members > 0 then
                redis.call("sadd", members_key, unpack(child_members))
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
end

-- Maintain member-keys (span-buf:mk) tracking sets so the flusher
-- knows which payload keys to fetch.
local member_keys_key = string.format("span-buf:mk:{%s}:%s", project_and_trace, set_span_id)
redis.call("sadd", member_keys_key, parent_span_id)

-- Merge child tracking sets from span_ids that were previously segment roots.
for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]
    if span_id ~= parent_span_id then
        local child_mk_key = string.format("span-buf:mk:{%s}:%s", project_and_trace, span_id)
        local child_members = redis.call("smembers", child_mk_key)
        if #child_members > 0 then
            redis.call("sadd", member_keys_key, unpack(child_members))
            redis.call("del", child_mk_key)
        end
    end
end

-- Merge parent's tracking set if parent_span_id redirected to a different root.
if set_span_id ~= parent_span_id then
    local parent_mk_key = string.format("span-buf:mk:{%s}:%s", project_and_trace, parent_span_id)
    local parent_members = redis.call("smembers", parent_mk_key)
    if #parent_members > 0 then
        redis.call("sadd", member_keys_key, unpack(parent_members))
        redis.call("del", parent_mk_key)
    end
end

redis.call("expire", member_keys_key, set_timeout)
local merge_payload_keys_end_time_ms = get_time_ms()
table.insert(latency_table, {"merge_payload_keys_step_latency_ms", merge_payload_keys_end_time_ms - redirect_end_time_ms})

-- Merge ic/ibc counters from child keys into the segment root.
local ingested_count_key = string.format("span-buf:ic:%s", set_key)
local ingested_byte_count_key = string.format("span-buf:ibc:%s", set_key)
for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]
    if span_id ~= parent_span_id then
        local child_merged = string.format("span-buf:s:{%s}:%s", project_and_trace, span_id)
        local child_ic_key = string.format("span-buf:ic:%s", child_merged)
        local child_ibc_key = string.format("span-buf:ibc:%s", child_merged)
        local child_count = redis.call("get", child_ic_key)
        local child_byte_count = redis.call("get", child_ibc_key)
        if child_count then
            redis.call("incrby", ingested_count_key, child_count)
            redis.call("del", child_ic_key)
        end
        if child_byte_count then
            redis.call("incrby", ingested_byte_count_key, child_byte_count)
            redis.call("del", child_ibc_key)
        end
    end
end
if set_span_id ~= parent_span_id then
    local parent_merged = string.format("span-buf:s:{%s}:%s", project_and_trace, parent_span_id)
    local parent_ic_key = string.format("span-buf:ic:%s", parent_merged)
    local parent_ibc_key = string.format("span-buf:ibc:%s", parent_merged)
    local parent_count = redis.call("get", parent_ic_key)
    local parent_byte_count = redis.call("get", parent_ibc_key)
    if parent_count then
        redis.call("incrby", ingested_count_key, parent_count)
        redis.call("del", parent_ic_key)
    end
    if parent_byte_count then
        redis.call("incrby", ingested_byte_count_key, parent_byte_count)
        redis.call("del", parent_ibc_key)
    end
end
local counter_merge_end_time_ms = get_time_ms()
table.insert(latency_table, {"counter_merge_step_latency_ms", counter_merge_end_time_ms - merge_payload_keys_end_time_ms})

-- Track total number of spans ingested for this segment
redis.call("incrby", ingested_count_key, num_spans)
redis.call("incrby", ingested_byte_count_key, byte_count)
redis.call("expire", ingested_count_key, set_timeout)
redis.call("expire", ingested_byte_count_key, set_timeout)

local ingested_count_end_time_ms = get_time_ms()
local ingested_count_step_latency_ms = ingested_count_end_time_ms - counter_merge_end_time_ms
table.insert(latency_table, {"ingested_count_step_latency_ms", ingested_count_step_latency_ms})

-- Capture end time and calculate latency in milliseconds
local end_time_ms = get_time_ms()
local latency_ms = end_time_ms - start_time_ms
table.insert(latency_table, {"total_step_latency_ms", latency_ms})

return {set_key, has_root_span, latency_ms, latency_table, metrics_table}
