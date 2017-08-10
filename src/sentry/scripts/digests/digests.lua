function table.extend(t, items)
    for _, item in ipairs(items) do
        table.insert(t, item)
    end
end

function table.slice(t, ...)
    local start, stop = ...
    if stop == nil then
        stop = #t
    end
    local result = {}
    for i = start, stop do
        table.insert(result, t[i])
    end
    return result
end

local noop = function ()
    return
end

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

    local zadd_args = {}
    local zrem_args = {}
    for key, score in zrange_scored_iterator(keys) do
        table.insert(zrem_args, key)
        table.extend(zadd_args, {score, key})
        callback(key, score)
    end

    -- TODO: This should support modifiers, and maintenance ZADD should include
    -- the "NX" modifier to avoid resetting schedules during a race conditions
    -- between a digest task and the maintenance task.
    redis.call('ZADD', destination, unpack(zadd_args))
    redis.call('ZREM', source, unpack(zrem_args))
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

local function schedule(configuration, deadline)
    local response = {}
    zrange_move_slice(
        configuration:get_schedule_waiting_key(),
        configuration:get_schedule_ready_key(),
        deadline,
        function (timeline_id, timestamp)
            table.insert(response, {timeline_id, timestamp})
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

    -- TODO: Validating `timeline_capacity` and casting to number should happen upstream.
    local timeline_capacity = tonumber(timeline_capacity)
    -- TODO: Validating `truncation_chance` and casting to number should happen upstream.
    if timeline_capacity > 0 and math.random() < tonumber(truncation_chance) then
        truncate_timeline(configuration, timeline_id, timeline_capacity)
    end

    return ready
end

local function digest_timeline(configuration, timeline_id)
    -- Check to ensure that the timeline is in the correct state.
    if redis.call('ZSCORE', configuration:get_schedule_ready_key(), timeline_id) == false then
        error('err(invalid_state): timeline is not in the ready state, cannot be digested')
    end

    local digest_key = configuration:get_timeline_digest_key(timeline_id)
    local timeline_key = configuration:get_timeline_key(timeline_id)
    if redis.call('EXISTS', digest_key) == 1 then
        -- If the digest set already exists (possibly because we already tried
        -- to send it and failed for some reason), merge any new data into it.
        -- TODO: It might make sense to trim here to avoid returning capacity *
        -- 2 if timeline was full when it was previously digested.
        redis.call('ZUNIONSTORE', digest_key, 2, timeline_key, digest_key, 'AGGREGATE', 'MAX')
        redis.call('DEL', timeline_key)
        redis.call('EXPIRE', digest_key, configuration.ttl)
    elseif redis.call('EXISTS', timeline_key) == 1 then
        -- Otherwise, we can just move the timeline contents to the digest key.
        redis.call('RENAME', timeline_key, digest_key)
        redis.call('EXPIRE', digest_key, configuration.ttl)
    end

    local results = {}
    local records = redis.call('ZREVRANGE', digest_key, 0, -1, 'WITHSCORES')
    for key, score in zrange_scored_iterator(records) do
        table.insert(results, {
            key,
            redis.call('GET', configuration:get_timeline_record_key(timeline_id, key)),
            score
        })
    end

    return results
end

local function close_digest(configuration, timeline_id, delay_minimum, ...)
    local record_ids = {...}
    local timeline_key = configuration:get_timeline_key(timeline_id)
    local digest_key = configuration:get_timeline_digest_key(timeline_id)

    if #record_ids > 0 then
        redis.call('ZREM', digest_key, unpack(record_ids))
        for _, record_id in ipairs(record_ids) do
            -- TODO: This could technically be called as a variadic instead, if it mattered.
            redis.call('DEL', configuration:get_timeline_record_key(timeline_id, record_id))
        end
    end

    -- We always add to the ready set if we digested any number of records or
    -- there are contents waiting to be delivered.
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

local function parse_arguments(arguments)
    -- TODO: These need validation!
    local configuration = {
        namespace = arguments[1],
        ttl = tonumber(arguments[2]),
        timestamp = tonumber(arguments[3]),
    }

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

    return configuration, table.slice(arguments, 4)
end

local commands = {
    SCHEDULE = function (arguments)
        local configuration, arguments = parse_arguments(arguments)
        return schedule(configuration, unpack(arguments))
    end,
    MAINTENANCE = function (arguments)
        local configuration, arguments = parse_arguments(arguments)
        return maintenance(configuration, unpack(arguments))
    end,
    ADD = function (arguments)
        local configuration, arguments = parse_arguments(arguments)
        return add_record_to_timeline(configuration, unpack(arguments))
    end,
    DELETE = function (arguments)
        local configuration, arguments = parse_arguments(arguments)
        return delete_timeline(configuration, unpack(arguments))
    end,
    DIGEST_OPEN = function (arguments)
        local configuration, arguments = parse_arguments(arguments)
        return digest_timeline(configuration, unpack(arguments))
    end,
    DIGEST_CLOSE = function (arguments)
        local configuration, arguments = parse_arguments(arguments)
        return close_digest(configuration, unpack(arguments))
    end,
}

return commands[ARGV[1]](table.slice(ARGV, 2))
