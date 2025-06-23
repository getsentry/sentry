--[[

Add a set of spans to the span buffer.

KEYS:
- "project_id:trace_id" -- just for redis-cluster routing, all keys that the script uses are sharded like this/have this hashtag.

ARGS:
- num_spans -- int
- parent_span_id -- str
- has_root_span -- "true" or "false"
- set_timeout -- int
- *span_id -- str[]

]]--

local project_and_trace = KEYS[1]

local num_spans = ARGV[1]
local parent_span_id = ARGV[2]
local has_root_span = ARGV[3] == "true"
local set_timeout = tonumber(ARGV[4])
local max_spans = tonumber(ARGV[5])
local NUM_ARGS = 5

local set_span_id = parent_span_id
local redirect_depth = 0

local main_redirect_key = string.format("span-buf:sr:{%s}", project_and_trace)

for i = 0, max_spans do
    local new_set_span = redis.call("hget", main_redirect_key, set_span_id)
    redirect_depth = i
    if not new_set_span or new_set_span == set_span_id then
        break
    end

    set_span_id = new_set_span
end

local set_key = string.format("span-buf:z:{%s}:%s", project_and_trace, set_span_id)
local parent_key = string.format("span-buf:z:{%s}:%s", project_and_trace, parent_span_id)

local has_root_span_key = string.format("span-buf:hrs:%s", set_key)
has_root_span = has_root_span or redis.call("get", has_root_span_key) == "1"
if has_root_span then
    redis.call("setex", has_root_span_key, set_timeout, "1")
end

local hset_args = {}
local sunionstore_args = {}

if set_span_id ~= parent_span_id and redis.call("zcard", parent_key) > 0 then
    table.insert(sunionstore_args, parent_key)
end

for i = NUM_ARGS + 1, NUM_ARGS + num_spans do
    local span_id = ARGV[i]
    local is_root_span = span_id == parent_span_id

    table.insert(hset_args, span_id)
    table.insert(hset_args, set_span_id)

    if not is_root_span then
        local span_key = string.format("span-buf:z:{%s}:%s", project_and_trace, span_id)
        table.insert(sunionstore_args, span_key)
    end
end

redis.call("hset", main_redirect_key, unpack(hset_args))
redis.call("expire", main_redirect_key, set_timeout)

if #sunionstore_args > 0 then
    local span_count = redis.call("zunionstore", set_key, #sunionstore_args + 1, set_key, unpack(sunionstore_args))
    redis.call("unlink", unpack(sunionstore_args))

    if span_count > max_spans then
        redis.call("zpopmin", set_key, 0, span_count - max_spans)
    end
end

redis.call("expire", set_key, set_timeout)

return {redirect_depth, set_key, has_root_span}
