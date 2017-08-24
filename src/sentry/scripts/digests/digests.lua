-- Utilities

local noop = function ()
    return
end

local function identity(...)
    return ...
end

function table.extend(t, items, length)
    -- The table length can be provided if you know the length of the table
    -- beforehand to avoid a potentially expensive length operator call.
    if length == nil then
        length = #t
    end
    for i, item in ipairs(items) do
        t[length + i] = item
    end
end

local function chunked(size, iterator, state, ...)
    local next = {iterator(state, ...)}
    local chunk_count = 1

    return function ()
        local item_count = 0
        if #next == 0 then
            return nil
        end

        return chunk_count, function ()
            if item_count == size or #next == 0 then
                chunk_count = chunk_count + 1
                return nil
            end

            local result = next
            next = {iterator(state, result[1])}

            item_count = item_count + 1
            return item_count, unpack(result)
        end
    end
end


-- Argument Parsing

local function argument_parser(callback)
    if callback == nil then
        callback = identity
    end

    return function (cursor, arguments)
        return cursor + 1, callback(arguments[cursor])
    end
end

local function object_argument_parser(schema, callback)
    if callback == nil then
        callback = identity
    end

    return function (cursor, arguments)
        local result = {}
        for i, specification in ipairs(schema) do
            local key, parser = unpack(specification)
            cursor, result[key] = parser(cursor, arguments)
        end
        return cursor, callback(result)
    end
end

local function variadic_argument_parser(argument_parser)
    return function (cursor, arguments)
        local results = {}
        local i = 1
        while arguments[cursor] ~= nil do
            cursor, results[i] = argument_parser(cursor, arguments)
            i = i + 1
        end
        return cursor, results
    end
end

local function multiple_argument_parser(...)
    local parsers = {...}
    return function (cursor, arguments)
        local results = {}
        for i, parser in ipairs(parsers) do
            cursor, results[i] = parser(cursor, arguments)
        end
        return cursor, unpack(results)
    end
end


-- Redis Helpers

local function zrange_scored_iterator(result)
    local i = -1
    return function ()
        i = i + 2
        return result[i], result[i+1]
    end
end

local function zrange_move_slice(source, destination, threshold, callback)
    local callback = callback
    if callback == nil then
        callback = noop
    end

    local keys = redis.call('ZRANGEBYSCORE', source, 0, threshold, 'WITHSCORES')
    if #keys == 0 then
        return
    end

    -- NOTE: The actual number of arguments is the chunk size * 2, since the
    -- ZADD command takes two arguments per item.
    for _, chunk_iterator in chunked(500, zrange_scored_iterator(keys)) do
        local zadd_args = {}
        local zrem_args = {}
        for i, key, score in chunk_iterator do
            table.extend(zadd_args, {score, key}, (i - 1) * 2)
            zrem_args[i] = key
            callback(key, score)
        end

        -- TODO: This should support modifiers, and maintenance ZADD should
        -- include the "NX" modifier to avoid resetting schedules during a race
        -- conditions between a digest task and the maintenance task.
        redis.call('ZADD', destination, unpack(zadd_args))
        redis.call('ZREM', source, unpack(zrem_args))
    end
end

local function zset_trim(key, capacity, callback)
    local callback = callback
    if callback == nil then
        callback = noop
    end

    local n = 0

    -- ZCARD is O(1) while ZREVRANGE is O(log(N)+M) so as long as the set is
    -- generally smaller than the limit (which seems like a safe assumption)
    -- then its cheaper just to check here and exit if there's nothing to do.
    if redis.call('ZCARD', key) <= capacity then
        return n
    end

    local items = redis.call('ZREVRANGE', key, capacity, -1)
    for _, item in ipairs(items) do
        redis.call('ZREM', key, item)
        callback(item)
        n = n + 1
    end

    return n
end


-- Timeline and Schedule Operations

local function schedule(configuration, deadline)
    local response = {}
    local i = 0
    zrange_move_slice(
        configuration:get_schedule_waiting_key(),
        configuration:get_schedule_ready_key(),
        deadline,
        function (timeline_id, timestamp)
            i = i + 1
            response[i] = {timeline_id, timestamp}
        end
    )
    return response
end

local function maintenance(configuration, deadline)
    zrange_move_slice(
        configuration:get_schedule_ready_key(),
        configuration:get_schedule_waiting_key(),
        deadline
    )
end

local function add_timeline_to_schedule(configuration, timeline_id, timestamp, increment, maximum)
    -- If the timeline is already in the "ready" set, this is a noop.
    if redis.call('ZSCORE', configuration:get_schedule_ready_key(), timeline_id) ~= false then
        return false
    end

    local score = redis.call('ZSCORE', configuration:get_schedule_waiting_key(), timeline_id)
    if score == false then
        -- If the timeline isn't already in either set, add it to the "ready" set with
        -- the provided timestamp. This allows for immediate scheduling, bypassing the
        -- imposed delay of the "waiting" state. (This should also be ZADD NX, but
        -- like above, this allows us to still work with older Redis.)
        redis.call('ZADD', configuration:get_schedule_ready_key(), timestamp, timeline_id)
        return true
    end

    -- If the timeline is already in the "waiting" set, increase the delay by
    -- min(current schedule + increment value, maximum delay after last
    -- processing time).
    local last_processed = tonumber(redis.call('GET', configuration:get_timeline_last_processed_timestamp_key(timeline_id)))
    local update = nil
    if last_processed == nil then
        -- If the last processed timestamp is missing for some reason (possibly
        -- evicted), be conservative and allow the timeline to be scheduled
        -- with either the current schedule time or provided timestamp,
        -- whichever is smaller.
        update = math.min(score, timestamp)
    else
        update = math.min(
            score + increment,
            last_processed + maximum
        )
    end

    if update ~= score then
        -- This should technically be ZADD XX for correctness (this item
        -- should always exist, and we established that above) but not
        -- using that here doesn't break anything and allows use to use
        -- older Redis versions.
        redis.call('ZADD', configuration:get_schedule_waiting_key(), update, timeline_id)
    end

    return false
end

local function truncate_timeline(configuration, timeline_id, capacity)
    return zset_trim(
        configuration:get_timeline_key(timeline_id),
        capacity,
        function (record_id)
            redis.call('DEL', configuration:get_timeline_record_key(timeline_id, record_id))
        end
    )
end

local function truncate_digest(configuration, timeline_id, capacity)
    return zset_trim(
        configuration:get_timeline_digest_key(timeline_id),
        capacity,
        function (record_id)
            redis.call('DEL', configuration:get_timeline_record_key(timeline_id, record_id))
        end
    )
end

local function add_record_to_timeline(configuration, timeline_id, record_id, value, timestamp, delay_increment, delay_maximum, timeline_capacity, truncation_chance)
    redis.call('SETEX', configuration:get_timeline_record_key(timeline_id, record_id), configuration.ttl, value)
    redis.call('ZADD', configuration:get_timeline_key(timeline_id), timestamp, record_id)
    redis.call('EXPIRE', configuration:get_timeline_key(timeline_id), configuration.ttl)

    local ready = add_timeline_to_schedule(configuration, timeline_id, timestamp, delay_increment, delay_maximum)

    if timeline_capacity > 0 and math.random() < truncation_chance then
        truncate_timeline(configuration, timeline_id, timeline_capacity)
    end

    return ready
end

local function digest_timeline(configuration, timeline_id, timeline_capacity)
    -- Check to ensure that the timeline is in the correct state.
    if redis.call('ZSCORE', configuration:get_schedule_ready_key(), timeline_id) == false then
        error('err(invalid_state): timeline is not in the ready state, cannot be digested')
    end

    local digest_key = configuration:get_timeline_digest_key(timeline_id)
    local timeline_key = configuration:get_timeline_key(timeline_id)
    if redis.call('EXISTS', timeline_key) == 1 then
        if redis.call('EXISTS', digest_key) == 1 then
            -- If the digest set already exists (possibly because we already tried
            -- to send it and failed for some reason), merge any new data into it.
            redis.call('ZUNIONSTORE', digest_key, 2, timeline_key, digest_key, 'AGGREGATE', 'MAX')
            redis.call('DEL', timeline_key)

            -- After merging, we have to do a capacity check (if we didn't,
            -- it's possible that this digest could grow to an unbounded size
            -- if it is never actually closed.)
            if timeline_capacity > 0 then
                truncate_digest(configuration, timeline_id, timeline_capacity)
            end
        else
            -- Otherwise, we can just move the timeline contents to the digest key.
            redis.call('RENAME', timeline_key, digest_key)
        end
        redis.call('EXPIRE', digest_key, configuration.ttl)
    end

    local results = {}
    local records = redis.call('ZREVRANGE', digest_key, 0, -1, 'WITHSCORES')
    local i = 0
    for key, score in zrange_scored_iterator(records) do
        i = i + 1
        results[i] = {
            key,
            redis.call('GET', configuration:get_timeline_record_key(timeline_id, key)),
            score
        }
    end

    return results
end

local function close_digest(configuration, timeline_id, delay_minimum, record_ids)
    local timeline_key = configuration:get_timeline_key(timeline_id)
    local digest_key = configuration:get_timeline_digest_key(timeline_id)

    for _, chunk_iterator in chunked(1000, ipairs(record_ids)) do
        local record_id_chunk = {}
        local record_key_chunk = {}
        for i, _, record_id in chunk_iterator do
            record_id_chunk[i] = record_id
            record_key_chunk[i] = configuration:get_timeline_record_key(timeline_id, record_id)
        end
        redis.call('ZREM', digest_key, unpack(record_id_chunk))
        redis.call('DEL', unpack(record_key_chunk))
    end

    -- If this digest didn't contain any data (no record IDs) and there isn't
    -- any data left in the timeline or digest sets, we can safely remove this
    -- timeline reference from all schedule sets.
    if #record_ids > 0 or redis.call('ZCARD', timeline_key) > 0 or redis.call('ZCARD', digest_key) > 0 then
        redis.call('SETEX', configuration:get_timeline_last_processed_timestamp_key(timeline_id), configuration.ttl, configuration.timestamp)
        redis.call('ZREM', configuration:get_schedule_ready_key(), timeline_id)
        redis.call('ZADD', configuration:get_schedule_waiting_key(), configuration.timestamp + delay_minimum, timeline_id)
    else
        redis.call('DEL', configuration:get_timeline_last_processed_timestamp_key(timeline_id))
        redis.call('ZREM', configuration:get_schedule_ready_key(), timeline_id)
        redis.call('ZREM', configuration:get_schedule_waiting_key(), timeline_id)
    end
end

local function delete_timeline(configuration, timeline_id)
    truncate_timeline(configuration, timeline_id, 0)
    truncate_digest(configuration, timeline_id, 0)
    redis.call('DEL', configuration:get_timeline_last_processed_timestamp_key(timeline_id))
    redis.call('ZREM', configuration:get_schedule_ready_key(), timeline_id)
    redis.call('ZREM', configuration:get_schedule_waiting_key(), timeline_id)
end


-- Command Execution

local configuration_argument_parser = object_argument_parser({
    {"namespace", argument_parser()},
    {"ttl", argument_parser(tonumber)},
    {"timestamp", argument_parser(tonumber)},
}, function (configuration)
    math.randomseed(configuration.timestamp)

    function configuration:get_schedule_waiting_key()
        return string.format('%s:s:w', self.namespace)
    end

    function configuration:get_schedule_ready_key()
        return string.format('%s:s:r', self.namespace)
    end

    function configuration:get_timeline_key(timeline_id)
        return string.format('%s:t:%s', self.namespace, timeline_id)
    end

    function configuration:get_timeline_digest_key(timeline_id)
        return string.format('%s:t:%s:d', self.namespace, timeline_id)
    end

    function configuration:get_timeline_last_processed_timestamp_key(timeline_id)
        return string.format('%s:t:%s:l', self.namespace, timeline_id)
    end

    function configuration:get_timeline_record_key(timeline_id, record_id)
        return string.format('%s:t:%s:r:%s', self.namespace, timeline_id, record_id)
    end

    return configuration
end)

local commands = {
    SCHEDULE = function (cursor, arguments)
        local cursor, configuration, deadline = multiple_argument_parser(
            configuration_argument_parser,
            argument_parser(tonumber)
        )(cursor, arguments)
        return schedule(configuration, deadline)
    end,
    MAINTENANCE = function (cursor, arguments)
        local cursor, configuration, deadline = multiple_argument_parser(
            configuration_argument_parser,
            argument_parser(tonumber)
        )(cursor, arguments)
        return maintenance(configuration, deadline)
    end,
    ADD = function (cursor, arguments)
        local cursor, configuration, arguments = multiple_argument_parser(
            configuration_argument_parser,
            object_argument_parser({
                {"timeline_id", argument_parser()},
                {"record_id", argument_parser()},
                {"value", argument_parser()},
                {"timestamp", argument_parser(tonumber)},
                {"delay_increment", argument_parser(tonumber)},
                {"delay_maximum", argument_parser(tonumber)},
                {"timeline_capacity", argument_parser(tonumber)},
                {"truncation_chance", argument_parser(tonumber)},
            })
        )(cursor, arguments)
        return add_record_to_timeline(
            configuration,
            arguments.timeline_id,
            arguments.record_id,
            arguments.value,
            arguments.timestamp,
            arguments.delay_increment,
            arguments.delay_maximum,
            arguments.timeline_capacity,
            arguments.truncation_chance
        )
    end,
    DELETE = function (cursor, arguments)
        local cursor, configuration, timeline_id = multiple_argument_parser(
            configuration_argument_parser,
            argument_parser()
        )(cursor, arguments)
        return delete_timeline(configuration, timeline_id)
    end,
    DIGEST_OPEN = function (cursor, arguments)
        local cursor, configuration, timeline_id, timeline_capacity = multiple_argument_parser(
            configuration_argument_parser,
            argument_parser(),
            argument_parser(tonumber)
        )(cursor, arguments)
        return digest_timeline(configuration, timeline_id, timeline_capacity)
    end,
    DIGEST_CLOSE = function (cursor, arguments)
        local cursor, configuration, timeline_id, delay_minimum, record_ids = multiple_argument_parser(
            configuration_argument_parser,
            argument_parser(),
            argument_parser(tonumber),
            variadic_argument_parser(argument_parser())
        )(cursor, arguments)
        return close_digest(configuration, timeline_id, delay_minimum, record_ids)
    end,
}

local cursor, command = argument_parser(
    function (argument)
        return commands[argument]
    end
)(1, ARGV)

return command(cursor, ARGV)
