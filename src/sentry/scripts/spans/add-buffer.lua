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
2. Merge subsegments when a common parent is found.
3. Update the redirect set to reflect the current state of the tree.


KEYS:
- "project_id:trace_id" -- just for redis-cluster routing, all keys that the script uses are sharded like this/have this hashtag.

ARGS:
- num_spans -- int -- Number of spans in the subsegment.
- parent_span_id -- str -- The parent span id of the root of the subsegment.
- has_root_span -- "true" or "false" -- Whether the subsegment contains the root of the segment.
- set_timeout -- int
- max_segment_bytes -- int -- The maximum number of bytes the segment can contain.
- byte_count -- int -- The total number of bytes in the subsegment.
- zero_copy_dest_threshold -- int -- When > 0, use SMEMBERS+SADD instead of SUNIONSTORE when the destination set exceeds this many bytes.
- write_distributed_payloads -- "true" or "false" -- When true, maintain member-keys tracking sets for distributed payload keys.
- write_merged_payloads -- "true" or "false" -- When false, skip set merges and set keys expire cmds.
- *span_id -- str[] -- The span ids in the subsegment.

RETURNS:
- set_key -- str -- The Redis key of the segment this subsegment was merged into.
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
local max_segment_bytes = tonumber(ARGV[5])
local byte_count = tonumber(ARGV[6])
local zero_copy_dest_threshold = tonumber(ARGV[7])
local write_distributed_payloads = ARGV[8] == "true"
local write_merged_payloads = ARGV[9] == "true"
local NUM_ARGS = 9

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
local redirect_end_time_ms = get_time_ms()
table.insert(latency_table, {"redirect_step_latency_ms", redirect_end_time_ms - start_time_ms})

local set_key = string.format("span-buf:s:{%s}:%s", project_and_trace, set_span_id)
local parent_key = string.format("span-buf:s:{%s}:%s", project_and_trace, parent_span_id)

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
if write_merged_payloads and set_span_id ~= parent_span_id and redis.call("scard", parent_key) > 0 then
    table.insert(sunionstore_args, parent_key)
end

for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]
    local is_root_span = span_id == parent_span_id

    table.insert(hset_args, span_id)
    table.insert(hset_args, set_span_id)

    if not is_root_span and write_merged_payloads then
        local span_key = string.format("span-buf:s:{%s}:%s", project_and_trace, span_id)
        table.insert(sunionstore_args, span_key)
    end
end

redis.call("hset", main_redirect_key, unpack(hset_args))
redis.call("expire", main_redirect_key, set_timeout)

local sunionstore_args_end_time_ms = get_time_ms()
table.insert(latency_table, {"sunionstore_args_step_latency_ms", sunionstore_args_end_time_ms - redirect_end_time_ms})

-- Merge spans into the parent span set.
-- Used outside the if statement
local arg_cleanup_end_time_ms = sunionstore_args_end_time_ms
-- Maintain member-keys (span-buf:mk) tracking sets so the flusher
-- knows which distributed keys to fetch. This runs in both write-only and
-- full distributed mode.
if write_distributed_payloads then
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
    arg_cleanup_end_time_ms = get_time_ms()
    table.insert(latency_table, {"distributed_tracking_step_latency_ms", arg_cleanup_end_time_ms - sunionstore_args_end_time_ms})
end

-- When write_merged_payloads is false, merged set merges are skipped but we
-- still need to merge ic/ibc counters from child keys into the segment root.
if not write_merged_payloads then
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
    arg_cleanup_end_time_ms = get_time_ms()
    table.insert(latency_table, {"distributed_ibc_merge_step_latency_ms", arg_cleanup_end_time_ms - sunionstore_args_end_time_ms})

elseif #sunionstore_args > 0 then
    local dest_memory = redis.call("memory", "usage", set_key) or 0
    local ingested_byte_count_key = string.format("span-buf:ibc:%s", set_key)
    local dest_bytes = tonumber(redis.call("get", ingested_byte_count_key) or 0)

    local already_oversized = dest_bytes > max_segment_bytes
    table.insert(metrics_table, {"parent_span_set_already_oversized", already_oversized and 1 or 0})

    local use_zero_copy_dest = not already_oversized and zero_copy_dest_threshold > 0 and dest_memory > zero_copy_dest_threshold

    local start_output_size = redis.call("scard", set_key)
    local scard_end_time_ms = get_time_ms()
    table.insert(latency_table, {"scard_step_latency_ms", scard_end_time_ms - sunionstore_args_end_time_ms})

    local output_size
    if already_oversized then
        -- Dest already exceeds max_segment_bytes, skip merge entirely.
        output_size = start_output_size
    elseif use_zero_copy_dest then
        -- Zero-copy: read each source set and SADD its members into dest.
        -- Avoids SUNIONSTORE re-reading the entire large destination set.
        local all_members = {}
        for i = 1, #sunionstore_args do
            local members = redis.call("smembers", sunionstore_args[i])
            for j = 1, #members do
                all_members[#all_members + 1] = members[j]
            end
        end
        table.insert(metrics_table, {"zero_copy_dest_source_members", #all_members})
        -- Batch SADD in chunks to avoid exceeding Lua's unpack() stack limit.
        local BATCH = 7000
        for i = 1, #all_members, BATCH do
            local last = math.min(i + BATCH - 1, #all_members)
            redis.call("sadd", set_key, unpack(all_members, i, last))
        end
        output_size = redis.call("scard", set_key)
    else
        output_size = redis.call("sunionstore", set_key, set_key, unpack(sunionstore_args))
    end
    table.insert(metrics_table, {"used_zero_copy_dest", use_zero_copy_dest and 1 or 0})
    local sunionstore_end_time_ms = get_time_ms()
    table.insert(latency_table, {"sunionstore_step_latency_ms", sunionstore_end_time_ms - scard_end_time_ms})

    redis.call("unlink", unpack(sunionstore_args))
    local unlink_end_time_ms = get_time_ms()
    table.insert(latency_table, {"unlink_step_latency_ms", unlink_end_time_ms - sunionstore_end_time_ms})

    table.insert(metrics_table, {"parent_span_set_before_size", start_output_size})
    table.insert(metrics_table, {"parent_span_set_after_size", output_size})
    table.insert(metrics_table, {"elements_added", output_size - start_output_size})

    -- Merge ingested count keys for merged spans
    local ingested_count_key = string.format("span-buf:ic:%s", set_key)
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

    arg_cleanup_end_time_ms = get_time_ms()
    table.insert(latency_table, {"arg_cleanup_step_latency_ms", arg_cleanup_end_time_ms - unlink_end_time_ms})
end


-- Track total number of spans ingested for this segment
local ingested_count_key = string.format("span-buf:ic:%s", set_key)
local ingested_byte_count_key = string.format("span-buf:ibc:%s", set_key)
redis.call("incrby", ingested_count_key, num_spans)
redis.call("incrby", ingested_byte_count_key, byte_count)
redis.call("expire", ingested_count_key, set_timeout)
redis.call("expire", ingested_byte_count_key, set_timeout)

if write_merged_payloads then
    redis.call("expire", set_key, set_timeout)
end

local ingested_count_end_time_ms = get_time_ms()
local ingested_count_step_latency_ms = ingested_count_end_time_ms - arg_cleanup_end_time_ms
table.insert(latency_table, {"ingested_count_step_latency_ms", ingested_count_step_latency_ms})

-- Capture end time and calculate latency in milliseconds
local end_time_ms = get_time_ms()
local latency_ms = end_time_ms - start_time_ms
table.insert(latency_table, {"total_step_latency_ms", latency_ms})

return {set_key, has_root_span, latency_ms, latency_table, metrics_table}
