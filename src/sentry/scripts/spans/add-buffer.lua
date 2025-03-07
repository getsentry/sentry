--[[

Add a span to the span buffer.

KEYS:
- "project_id:trace_id" -- just for redis-cluster routing, all keys that the script uses are sharded like this/have this hashtag.

ARGS:
- payload -- str
- is_root_span -- bool
- span_id -- str
- parent_span_id -- str
- set_timeout -- int

]]--

local project_and_trace = KEYS[1]

local payload = ARGV[1]
local is_root_span = ARGV[2] == "true"
local span_id = ARGV[3]
local parent_span_id = ARGV[4]
local set_timeout = tonumber(ARGV[5])

local parent_key = string.format("span-buf:s:{%s}:%s", project_and_trace, parent_span_id)
local span_key = string.format("span-buf:s:{%s}:%s", project_and_trace, span_id)

local parent_set_redirect_key = string.format("span-buf:sr:{%s}:%s", project_and_trace, parent_span_id)
local set_redirect_key = string.format("span-buf:sr:{%s}:%s", project_and_trace, span_id)

local set_key = redis.call("get", parent_set_redirect_key) or parent_key

if not is_root_span then
    redis.call("sunionstore", set_key, set_key, span_key)
    redis.call("del", span_key)
end
redis.call("sadd", set_key, payload)
redis.call("expire", set_key, set_timeout)
redis.call("setex", set_redirect_key, set_timeout, set_key)

redis.call("expire", parent_set_redirect_key, set_timeout)

local has_root_span_key = string.format("span-buf:hrs:%s", set_key)
local has_root_span = redis.call("get", has_root_span_key) == "1"
if has_root_span or is_root_span then
    redis.call("setex", has_root_span_key, set_timeout, "1")
end

return {set_key, has_root_span or is_root_span}
