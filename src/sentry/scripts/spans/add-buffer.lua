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
- metrics_sample_rate -- int -- Collect metrics for 1 in N calls. 1 samples every call; 100 samples ~1%.
- *span_id -- str[] -- The span ids in the subsegment.

RETURNS:
- set_key -- str -- The key of the segment, used to look up member-keys index and identify the segment in the queue.
- has_root_span -- bool -- Whether this segment contains a root span.
- latency_us -- int -- Microseconds elapsed during script execution. -1 when this call is not sampled.
                       Integer microseconds because Redis truncates Lua numbers to integers in replies;
                       fractional milliseconds would come back as 0 for virtually every call, degrading
                       these values into 0/1 flags.
- latency_table -- table -- Per-step latency measurements in integer microseconds, flattened as
                            [key1, value1, key2, value2, ...]. Empty when this call is not sampled.
- metrics_table -- table -- Per-step gauge metrics, flattened as [key1, value1, key2, value2, ...]. Empty when
                            this call is not sampled.
- merged_segment_span_ids -- str[] -- Span ids of child segments merged into this segment. These were previously
queued as their own segments, so they are the only stale queue entries the
caller needs to remove.

NOTE: The latency_table, metrics_table and latency_ms are only populated for a sampled subset of
calls (1 in metrics_sample_rate, see ARGS above). These are distribution/gauge metrics, so the
sampled subset is statistically representative.

]] --

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

local num_spans = tonumber(ARGV[1])
local parent_span_id = ARGV[2]
local has_root_span = ARGV[3] == "true"
local set_timeout = tonumber(ARGV[4])
local byte_count = tonumber(ARGV[5])
local max_segment_bytes = tonumber(ARGV[6])
local salt = ARGV[7] or ""
local check_flush_lock = ARGV[8] == "true"
local metrics_sample_rate = tonumber(ARGV[9])
local NUM_ARGS = 9

local function get_time_us()
    local time = redis.call("TIME")
    return tonumber(time[1]) * 1000000 + tonumber(time[2])
end

local now = redis.call("TIME")

-- Reuse the time microseconds to make a sampling decision. A rate of 1 samples
-- every call; a rate of 100 samples ~1% of calls.
local sample_metrics = (tonumber(now[2]) % metrics_sample_rate) == 0

local start_time_us = 0
if sample_metrics then
    start_time_us = tonumber(now[1]) * 1000000 + tonumber(now[2])
end

local set_span_id = parent_span_id
local redirect_depth = 0

local main_redirect_key = "span-buf:ssr:{" .. project_and_trace .. "}"

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

-- latency_table and metrics_table are flattened lists of [key1, value1, key2, value2, ...]
-- so that the result is a flat array that is trivial to parse in Python, rather than a list
-- of nested {key, value} pair tables.
local latency_table = {}
local latency_table_len = 0
local function insert_latency(key, value)
    latency_table[latency_table_len + 1] = key
    latency_table[latency_table_len + 2] = value
    latency_table_len = latency_table_len + 2
end

local metrics_table = {}
local metrics_table_len = 0
local function insert_metrics(key, value)
    metrics_table[metrics_table_len + 1] = key
    metrics_table[metrics_table_len + 2] = value
    metrics_table_len = metrics_table_len + 2
end

if sample_metrics then
    insert_metrics("redirect_table_size", redis.call("hlen", main_redirect_key))
    insert_metrics("redirect_depth", redirect_depth)
end

-- Precompute prefixes once per invocation. These key builders are used in the span loops below,
-- where concatenation is cheaper than repeated string.format.
local span_prefix = "span-buf:s:{" .. project_and_trace .. "}:"
local ic_prefix = "span-buf:ic:" .. span_prefix
local ibc_prefix = "span-buf:ibc:" .. span_prefix
local mk_prefix = "span-buf:mk:{" .. project_and_trace .. "}:"

local set_key = span_prefix .. set_span_id

-- Reset the set expiry as we saw a new subsegment for this set
local has_root_span_key = "span-buf:hrs:" .. set_key
has_root_span = has_root_span or redis.call("get", has_root_span_key) == "1"
if has_root_span then
    redis.call("setex", has_root_span_key, set_timeout, "1")
end

local hset_args = {}
local num_hset_args = 0

for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]

    hset_args[num_hset_args + 1] = span_id
    hset_args[num_hset_args + 2] = set_span_id
    num_hset_args = num_hset_args + 2
end

redis.call("hset", main_redirect_key, unpack(hset_args))
redis.call("expire", main_redirect_key, set_timeout)

local redirect_end_time_us = 0
if sample_metrics then
    redirect_end_time_us = get_time_us()
    insert_latency("redirect_step_latency_us", redirect_end_time_us - start_time_us)
end

local ingested_byte_count_key = ibc_prefix .. set_span_id
local ingested_byte_count = tonumber(redis.call("get", ingested_byte_count_key) or 0)

-- Pre-processing loop runs first to collect all the keys.
local child_ic_keys = {}
local child_ibc_keys = {}
for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]
    if span_id ~= parent_span_id then
        child_ic_keys[#child_ic_keys + 1] = ic_prefix .. span_id
        child_ibc_keys[#child_ibc_keys + 1] = ibc_prefix .. span_id
    end
end

-- Bulk request is made for child_ic and child_ibc keys. MGET returns in order. Further down we'll use
-- the array. The merge loop iterates in the same order. We can use its index position to efficiently
-- retrieve the locally cached value.
local child_ics = {}
local child_ibcs = {}
if #child_ibc_keys > 0 then
    child_ics = redis.call("mget", unpack(child_ic_keys))
    child_ibcs = redis.call("mget", unpack(child_ibc_keys))
    for j = 1, #child_ibcs do
        byte_count = byte_count + tonumber(child_ibcs[j] or 0)
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
    local flush_lock_key = "span-buf:fl:" .. set_key
    segment_locked = redis.call("exists", flush_lock_key) == 1
end
if segment_too_large or segment_locked then
    set_span_id = salt
    set_key = span_prefix .. salt
    ingested_byte_count_key = ibc_prefix .. salt
end
if sample_metrics then
    insert_metrics("detached_segment_too_large", segment_too_large and 1 or 0)
    insert_metrics("detached_segment_locked", segment_locked and 1 or 0)
end

local ingested_count_key = ic_prefix .. set_span_id
local members_key = mk_prefix .. set_span_id

local merged_segment_span_ids = {}
local num_merged_segment_span_ids = 0

-- NOTE: This loop is assumed to match the iteration semantics of the child_ibc cache key
--       lookup loop. If it doesn't then this will breakerino.
local child_idx = 0
for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]
    if span_id ~= parent_span_id then
        child_idx = child_idx + 1

        local child_ic = child_ics[child_idx]
        if child_ic then
            redis.call("incrby", ingested_count_key, child_ic)
            redis.call("del", child_ic_keys[child_idx])
        end

        local child_ibc = child_ibcs[child_idx]
        if child_ibc then
            -- byte_count already holds the child's byte count, so we don't need to add again
            redis.call("del", child_ibc_keys[child_idx])
        end

        -- Presence of child_ic implies that this span is a root span. Only root spans have these associations.
        -- We can skip all the child spans (which will be no-ops) and save some Redis calls.
        if child_ic then
            local child_members_key = mk_prefix .. span_id
            merge_set(child_members_key, members_key)
            redis.call("del", child_members_key)
            num_merged_segment_span_ids = num_merged_segment_span_ids + 1
            merged_segment_span_ids[num_merged_segment_span_ids] = span_id
        end
    end
end

local merge_payload_keys_end_time_us = 0
if sample_metrics then
    merge_payload_keys_end_time_us = get_time_us()
    insert_latency("merge_payload_keys_step_latency_us",
        merge_payload_keys_end_time_us - redirect_end_time_us)
end

redis.call("sadd", members_key, salt)
redis.call("expire", members_key, set_timeout)

-- Track total number of spans ingested for this segment
redis.call("incrby", ingested_count_key, num_spans)
redis.call("incrby", ingested_byte_count_key, byte_count)
redis.call("expire", ingested_count_key, set_timeout)
redis.call("expire", ingested_byte_count_key, set_timeout)

-- -1 is a sentinel meaning "not sampled"; the consumer ignores these so they
-- don't pollute metrics. A real measurement is always >= 0.
local latency_us = -1
if sample_metrics then
    local counter_merge_end_time_us = get_time_us()
    insert_latency("counter_merge_step_latency_us",
        counter_merge_end_time_us - merge_payload_keys_end_time_us)
    latency_us = counter_merge_end_time_us - start_time_us
    insert_latency("total_step_latency_us", latency_us)
end

return { set_key, has_root_span, latency_us, latency_table, metrics_table, merged_segment_span_ids }
