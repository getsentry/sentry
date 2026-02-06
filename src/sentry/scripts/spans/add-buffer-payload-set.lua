--[[

This is a variant of add-buffer.lua that uses SETs instead of sorted sets (ZSETs).

When a segment exceeds max size, we use SPOP which removes random elements instead
of ZPOPMIN which removes the oldest. We rarely hit the size limit, so this acceptable.


KEYS:
- "project_id:trace_id" -- just for redis-cluster routing, all keys that the script uses are sharded like this/have this hashtag.

ARGS:
- num_spans -- int -- Number of spans in the subsegment.
- parent_span_id -- str -- The parent span id of the root of the subsegment.
- has_root_span -- "true" or "false" -- Whether the subsegment contains the root of the segment.
- set_timeout -- int
- max_segment_bytes -- int -- The maximum number of bytes the segment can contain.
- byte_count -- int -- The total number of bytes in the subsegment.
- *span_id -- str[] -- The span ids in the subsegment.

RETURNS:
- redirect_depth -- int
- set_key -- str
- has_root_span -- bool
- latency_ms -- number (milliseconds elapsed during script execution)

]]--

local project_and_trace = KEYS[1]

local num_spans = ARGV[1]
local parent_span_id = ARGV[2]
local has_root_span = ARGV[3] == "true"
local set_timeout = tonumber(ARGV[4])
local max_segment_bytes = tonumber(ARGV[5])
local byte_count = tonumber(ARGV[6])
local NUM_ARGS = 6

local function get_time_ms()
    local time = redis.call("TIME")
    return tonumber(time[1]) * 1000 + tonumber(time[2]) / 1000
end

-- Capture start time for latency measurement
local start_time_ms = get_time_ms()

local set_span_id = parent_span_id
local redirect_depth = 0

local main_redirect_key = string.format("span-buf:psr:{%s}", project_and_trace)

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
table.insert(metrics_table, {"payload_set_redirect_table_size", redis.call("hlen", main_redirect_key)})
table.insert(metrics_table, {"payload_set_redirect_depth", redirect_depth})
local redirect_end_time_ms = get_time_ms()
table.insert(latency_table, {"payload_set_redirect_step_latency_ms", redirect_end_time_ms - start_time_ms})

-- Use span-buf:s: prefix for regular SETs (vs span-buf:z: for ZSETs)
local set_key = string.format("span-buf:p:{%s}:%s", project_and_trace, set_span_id)
local parent_key = string.format("span-buf:p:{%s}:%s", project_and_trace, parent_span_id)

-- Reset the set expiry as we saw a new subsegment for this set
local has_root_span_key = string.format("span-buf:hrs:%s", set_key)
has_root_span = has_root_span or redis.call("get", has_root_span_key) == "1"
if has_root_span then
    redis.call("setex", has_root_span_key, set_timeout, "1")
end

local hset_args = {}
local sunionstore_args = {}

-- Merge the subsegment into the segment we are assembling.
-- Merging the spans (`sunionstore_args`) is needed to compose the payloads in
-- the same segment for them to be flushed later.
-- Updating the redirect set instead is needed when we receive higher level spans
-- for a tree we are assembling as the segment root each span points at in the
-- redirect set changes when a new root is found.
if set_span_id ~= parent_span_id and redis.call("scard", parent_key) > 0 then
    table.insert(sunionstore_args, parent_key)
end

for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]
    local is_root_span = span_id == parent_span_id

    table.insert(hset_args, span_id)
    table.insert(hset_args, set_span_id)

    if not is_root_span then
        local span_key = string.format("span-buf:p:{%s}:%s", project_and_trace, span_id)
        table.insert(sunionstore_args, span_key)
    end
end

redis.call("hset", main_redirect_key, unpack(hset_args))
redis.call("expire", main_redirect_key, set_timeout)

local sunionstore_args_end_time_ms = get_time_ms()
table.insert(latency_table, {"payload_set_sunionstore_args_step_latency_ms", sunionstore_args_end_time_ms - redirect_end_time_ms})

-- Merge spans into the parent span set.
-- Used outside the if statement
local spop_end_time_ms = -1
if #sunionstore_args > 0 then
    local start_output_size = redis.call("scard", set_key)
    local output_size = redis.call("sunionstore", set_key, set_key, unpack(sunionstore_args))
    redis.call("unlink", unpack(sunionstore_args))

    local sunionstore_end_time_ms = get_time_ms()
    table.insert(latency_table, {"payload_set_sunionstore_step_latency_ms", sunionstore_end_time_ms - sunionstore_args_end_time_ms})
    table.insert(metrics_table, {"payload_set_parent_span_set_before_size", start_output_size})
    table.insert(metrics_table, {"payload_set_parent_span_set_after_size", output_size})

    -- Merge ingested count keys for merged spans
    local ingested_count_key = string.format("span-buf:ic:%s", set_key)
    local ingested_byte_count_key = string.format("span-buf:ibc:%s", set_key)
    for i = 1, #sunionstore_args do
        local merged_key = sunionstore_args[i]
        local merged_ic_key = string.format("span-buf:ic:%s", merged_key)
        local merged_ibc_key = string.format("span-buf:ibc:%s", merged_key)
        local merged_count = redis.call("get", merged_ic_key)
        local merged_byte_count = redis.call("get", merged_ibc_key)
        if merged_count then
            redis.call("incrby", ingested_count_key, merged_count)
        end
        if merged_byte_count then
            redis.call("incrby", ingested_byte_count_key, merged_byte_count)
        end
        redis.call("del", merged_ic_key)
        redis.call("del", merged_ibc_key)
    end

    local arg_cleanup_end_time_ms = get_time_ms()
    table.insert(latency_table, {"payload_set_arg_cleanup_step_latency_ms", arg_cleanup_end_time_ms - sunionstore_end_time_ms})

    -- Use SPOP for size limiting. Unlike ZPOPMIN, SPOP removes random elements
    -- rather than the oldest. This is acceptable since we rarely hit the size limit.
    local spopcalls = 0
    while (redis.call("memory", "usage", set_key) or 0) > max_segment_bytes do
        redis.call("spop", set_key)
        spopcalls = spopcalls + 1
    end

    spop_end_time_ms = get_time_ms()
    table.insert(latency_table, {"payload_set_spop_step_latency_ms", spop_end_time_ms - arg_cleanup_end_time_ms})
    table.insert(metrics_table, {"payload_set_spopcalls", spopcalls})
end


-- Track total number of spans ingested for this segment
local ingested_count_key = string.format("span-buf:ic:%s", set_key)
local ingested_byte_count_key = string.format("span-buf:ibc:%s", set_key)
redis.call("incrby", ingested_count_key, num_spans)
redis.call("incrby", ingested_byte_count_key, byte_count)
redis.call("expire", ingested_count_key, set_timeout)
redis.call("expire", ingested_byte_count_key, set_timeout)

redis.call("expire", set_key, set_timeout)

local ingested_count_end_time_ms = get_time_ms()
local ingested_count_step_latency_ms = 0
if spop_end_time_ms >= 0 then
    ingested_count_step_latency_ms = ingested_count_end_time_ms - spop_end_time_ms
else
    ingested_count_step_latency_ms = ingested_count_end_time_ms - sunionstore_args_end_time_ms
end
table.insert(latency_table, {"payload_set_ingested_count_step_latency_ms", ingested_count_step_latency_ms})

-- Capture end time and calculate latency in milliseconds
local end_time_ms = get_time_ms()
local latency_ms = end_time_ms - start_time_ms
table.insert(latency_table, {"payload_set_total_step_latency_ms", latency_ms})

return {set_key, has_root_span, latency_ms, latency_table, metrics_table}
