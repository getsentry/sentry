--[[

Implements an index that can be used to efficiently search for items that
share similar characteristics.

This implementation is based on MinHash (which is used quickly identify
similar items and estimate the Jaccard similarity of their characteristic
sets) but this implementation extends the typical design to add the ability
to record items by an arbitrary key. This allows querying for similar
groups that contain many different characteristic sets.

This is modeled as two data structures:

- A bucket frequency hash, which maintains a count of what buckets
    have been recorded -- and how often -- in a ``(band, key)`` pair. This
    data can be used to identify what buckets a key is a member of, and also
    used to identify the degree of bucket similarity when comparing with data
    associated with another key.
- A bucket membership set, which maintains a record of what keys have been
    record in a ``(band, bucket)`` pair. This data can be used to identify
    what other keys may be similar to the lookup key (but not the degree of
    similarity.)

]]--
local function range(start, stop)
    local result = {}
    for i = start, stop do
        table.insert(result, i)
    end
    return result
end

function table.ifilter(t, f)
    local result = {}
    for i, value in ipairs(t) do
        if f(value) then
            table.insert(result, value)
        end
    end
    return result
end

function table.imap(t, f)
    local result = {}
    for i, value in ipairs(t) do
        result[i] = f(value)
    end
    return result
end

function table.ireduce(t, f, i)
    if i == nil then
        i = {}
    end
    local result = i
    for i, value in ipairs(t) do
        result = f(result, value)
    end
    return result
end

function table.izip(...)
    local args = {...}
    local n = math.max(
        unpack(
            table.imap(
                args,
                function (t) return #t end
            )
        )
    )
    local result = {}
    for i = 1, n do
        local item = {}
        for j = 1, #args do
            table.insert(item, args[j][i])
        end
        table.insert(result, item)
    end
    return result
end

function table.slice(t, start, stop)
    -- NOTE: ``stop`` is inclusive!
    local result = {}
    for i = start or 1, stop or #t do
        table.insert(result, t[i])
    end
    return result
end


-- Argument Parsing and Validation

local function parse_number(value)
    local result = tonumber(value)
    assert(result ~= nil, 'got nil, expected number')
    return result
end

local function parse_integer(value)
    local result = parse_number(value)
    assert(result % 1 == 0, 'got float, expected integer')
    return result
end

local function build_argument_parser(fields)
    return function (arguments)
        local results = {}
        for i = 1, #fields do
            local name, parser = unpack(fields[i])
            local value = arguments[i]
            local ok, result = pcall(parser, value)
            if not ok then
                error(string.format('received invalid argument for %q in position %s with value %q; %s', name, i, value, result))
            else
                results[name] = result
            end
        end
        return results, table.slice(arguments, #fields + 1)
    end
end


-- Time Series

local function get_active_indices(interval, retention, timestamp)
    local result = {}
    local upper = math.floor(timestamp / interval)
    for i = upper - retention, upper do
        table.insert(result, i)
    end
    return result
end

local function get_index_expiration_time(interval, retention, index)
    return (index + retention) * interval
end


-- Generic Configuration

local configuration_parser = build_argument_parser({
    {"timestamp", parse_integer},
    {"bands", parse_integer},
    {"interval", parse_integer},
    {"retention", parse_integer},
    {"scope", function (value)
        assert(value ~= nil)
        return value
    end}
})

local function takes_configuration(command)
    return function(arguments)
        local configuration, arguments = configuration_parser(arguments)
        return command(configuration, arguments)
    end
end


-- Key Generation

local function get_bucket_frequency_key(scope, index, time, band, item)
    return string.format(
        '%s:%s:f:%s:%s:%s:%s',
        'sim',
        scope,
        index,
        time,
        band,
        item
    )
end

local function get_bucket_membership_key(scope, index, time, band, bucket)
    return string.format(
        '%s:%s:m:%s:%s:%s:%s',
        'sim',
        scope,
        index,
        time,
        band,
        bucket
    )
end

local function get_manhattan_distance(target, other)
    local keys = {}
    for k, _ in pairs(target) do
        keys[k] = true
    end

    for k, _ in pairs(other) do
        keys[k] = true
    end

    local total = 0
    for k, _ in pairs(keys) do
        total = total + math.abs((target[k] or 0) - (other[k] or 0))
    end

    return total
end

local function scale_to_total(values)
    local result = {}
    local total = 0
    for key, value in pairs(values) do
        total = total + value
    end
    for key, value in pairs(values) do
        result[key] = value / total
    end
    return result
end


-- Command Parsing

local commands = {
    RECORD = takes_configuration(
        function (configuration, arguments)
            local key = arguments[1]

            local entries = table.ireduce(
                table.slice(arguments, 2),
                function (state, token)
                    if state.active == nil then
                        -- When there is no active entry, we need to initialize
                        -- a new one. The first token is the index identifier.
                        state.active = {index = token, buckets = {}}
                    else
                        -- If there is an active entry, we need to add the
                        -- current token to the feature list.
                        table.insert(state.active.buckets, token)

                        -- When we've seen the same number of buckets as there
                        -- are bands, we're done recording and need to mark the
                        -- current entry as completed, and reset the current
                        -- active entry.
                        if #state.active.buckets == configuration.bands then
                            table.insert(state.completed, state.active)
                            state.active = nil
                        end
                    end
                    return state
                end,
                {active = nil, completed = {}}
            )

            -- If there are any entries in progress when we are completed, that
            -- means the input was in an incorrect format and we should error
            -- before we record any bad data.
            assert(entries.active == nil, 'unexpected end of input')

            local time = math.floor(configuration.timestamp / configuration.interval)
            local expiration = get_index_expiration_time(
                configuration.interval,
                configuration.retention,
                time
            )

            return table.imap(
                entries.completed,
                function (entry)
                    local results = {}

                    for band, bucket in ipairs(entry.buckets) do
                        local bucket_membership_key = get_bucket_membership_key(
                            configuration.scope,
                            entry.index,
                            time,
                            band,
                            bucket
                        )
                        redis.call('SADD', bucket_membership_key, key)
                        redis.call('EXPIREAT', bucket_membership_key, expiration)

                        local bucket_frequency_key = get_bucket_frequency_key(
                            configuration.scope,
                            entry.index,
                            time,
                            band,
                            key
                        )
                        table.insert(
                            results,
                            tonumber(redis.call('HINCRBY', bucket_frequency_key, bucket, 1))
                        )
                        redis.call('EXPIREAT', bucket_frequency_key, expiration)
                    end

                    return results
                end
            )
        end
    ),
    QUERY = takes_configuration(
        function (configuration, arguments)
            local item_key = arguments[1]
            local indices = table.slice(arguments, 2)

            local time_series = get_active_indices(
                configuration.interval,
                configuration.retention,
                configuration.timestamp
            )

            -- Fetch all of the bucket frequencies for a key from a specific
            -- index from all active time series chunks. This returns a table
            -- containing n tables (where n is the number of bands) mapping
            -- bucket identifiers to counts.
            local fetch_bucket_frequencies = function (index, key)
                return table.imap(
                    range(1, configuration.bands),
                    function (band)
                        return table.ireduce(
                            table.imap(
                                time_series,
                                function (time)
                                    return redis.call(
                                        'HGETALL',
                                        get_bucket_frequency_key(
                                            configuration.scope,
                                            index,
                                            time,
                                            band,
                                            key
                                        )
                                    )
                                end
                            ),
                            function (result, response)
                                for i = 1, #response, 2 do
                                    local bucket, count = response[i], response[i + 1]
                                    result[bucket] = (result[bucket] or 0) + count
                                end
                                return result
                            end,
                            {}
                        )
                    end
                )
            end

            local fetch_candidates = function (index, frequencies)
                local candidates = {}  -- acts as a set
                for band, buckets in ipairs(frequencies) do
                    for bucket, count in pairs(buckets) do
                        for _, time in ipairs(time_series) do
                            -- Fetch all other items that have been added to
                            -- the same bucket in this band during this time
                            -- period.
                            local members = redis.call(
                                'SMEMBERS',
                                get_bucket_membership_key(
                                    configuration.scope,
                                    index,
                                    time,
                                    band,
                                    bucket
                                )
                            )
                            for _, member in ipairs(members) do
                                candidates[member] = true
                            end
                        end
                    end
                end
                return candidates
            end

            return table.imap(
                indices,
                function (index)
                    -- First, identify the which buckets that the key we are
                    -- querying is present in.
                    local item_frequencies = fetch_bucket_frequencies(index, item_key)

                    -- Then, find all iterms that also exist within those
                    -- buckets and fetch their frequencies.
                    local candidates = fetch_candidates(index, item_frequencies)
                    local candidate_frequencies = {}
                    for candidate_key, _ in pairs(candidates) do
                        candidate_frequencies[candidate_key] = fetch_bucket_frequencies(
                            index,
                            candidate_key
                        )
                    end

                    -- Then, calculate the similarity for each candidate based
                    -- on their frequencies.
                    local results = {}
                    for key, value in pairs(candidate_frequencies) do
                        table.insert(
                            results,
                            {
                                key,
                                table.ireduce(  -- sum, then avg
                                    table.imap(  -- calculate similarity
                                        table.izip(
                                            item_frequencies,
                                            value
                                        ),
                                        function (v)
                                            -- We calculate the "similarity"
                                            -- between two items by comparing
                                            -- how often their contents exist
                                            -- in the same buckets for a band.
                                            local dist = get_manhattan_distance(
                                                scale_to_total(v[1]),
                                                scale_to_total(v[2])
                                            )
                                            -- Since this is a measure of
                                            -- similarity (and not distance) we
                                            -- normalize the result to [0, 1]
                                            -- scale.
                                            return 1 - (dist / 2)
                                        end
                                    ),
                                    function (total, item)
                                        return total + item
                                    end,
                                    0
                                ) / configuration.bands
                            }
                        )
                    end

                    -- Sort the results in descending order (most similar first.)
                    table.sort(
                        results,
                        function (left, right)
                            return left[2] > right[2]
                        end
                    )

                    return table.imap(
                        results,
                        function (item)
                            return {
                                item[1],
                                string.format(
                                    '%f',  -- converting floats to strings avoids truncation
                                    item[2]
                                ),
                            }
                        end
                    )
                end
            )
        end
    ),
    MERGE = takes_configuration(
        function (configuration, arguments)
            local destination_key = arguments[1]
            local entries = table.ireduce(
                table.slice(arguments, 2),
                function (state, token)
                    if state.active == nil then
                        state.active = {
                            index = token,
                            key = nil,
                        }
                    else
                        assert(token ~= destination_key, 'cannot merge destination into itself')
                        state.active.key = token
                        table.insert(
                            state.completed,
                            state.active
                        )
                        state.active = nil
                    end
                    return state
                end,
                {active = nil, completed = {}}
            )
            assert(entries.active == nil, 'unexpected end of input')

            local time_series = get_active_indices(
                configuration.interval,
                configuration.retention,
                configuration.timestamp
            )

            for _, source in ipairs(entries.completed) do
                for band = 1, configuration.bands do
                    for _, time in ipairs(time_series) do
                        local source_bucket_frequency_key = get_bucket_frequency_key(
                            configuration.scope,
                            source.index,
                            time,
                            band,
                            source.key
                        )
                        local destination_bucket_frequency_key = get_bucket_frequency_key(
                            configuration.scope,
                            source.index,
                            time,
                            band,
                            destination_key
                        )
                        local expiration_time = get_index_expiration_time(
                            configuration.interval,
                            configuration.retention,
                            time
                        )

                        local response = redis.call(
                            'HGETALL',
                            source_bucket_frequency_key
                        )
                        for i = 1, #response, 2 do
                            local bucket, count = response[i], response[i + 1]

                            -- Remove the source from the bucket membership
                            -- set, and add the destination to the membership
                            -- set.
                            local bucket_membership_key = get_bucket_membership_key(
                                configuration.scope,
                                source.index,
                                time,
                                band,
                                bucket
                            )
                            redis.call('SREM', bucket_membership_key, source.key)
                            redis.call('SADD', bucket_membership_key, destination_key)
                            redis.call('EXPIREAT', bucket_membership_key, expiration_time)

                            -- Merge the counter values into the destination frequencies.
                            redis.call(
                                'HINCRBY',
                                destination_bucket_frequency_key,
                                bucket,
                                count
                            )
                        end

                        -- The destination bucket frequency key may have not
                        -- existed previously, so we need to make sure we set
                        -- the expiration on it in case it is new.
                        redis.call(
                            'EXPIREAT',
                            destination_bucket_frequency_key,
                            expiration_time
                        )

                        -- We no longer need the source frequencies.
                        redis.call('DEL', source_bucket_frequency_key)
                    end
                end
            end
        end
    ),
    DELETE = takes_configuration(
        function (configuration, arguments)
            local entries = table.ireduce(
                arguments,
                function (state, token)
                    if state.active == nil then
                        state.active = {
                            index = token,
                            key = nil,
                        }
                    else
                        state.active.key = token
                        table.insert(
                            state.completed,
                            state.active
                        )
                        state.active = nil
                    end
                    return state
                end,
                {active = nil, completed = {}}
            )
            assert(entries.active == nil, 'unexpected end of input')

            local time_series = get_active_indices(
                configuration.interval,
                configuration.retention,
                configuration.timestamp
            )

            for _, source in ipairs(entries.completed) do
                for band = 1, configuration.bands do
                    for _, time in ipairs(time_series) do
                        local source_bucket_frequency_key = get_bucket_frequency_key(
                            configuration.scope,
                            source.index,
                            time,
                            band,
                            source.key
                        )

                        local response = redis.call(
                            'HGETALL',
                            source_bucket_frequency_key
                        )

                        for i = 1, #response, 2 do
                            local bucket = response[i]
                            redis.call(
                                'SREM',
                                get_bucket_membership_key(
                                    configuration.scope,
                                    source.index,
                                    time,
                                    band,
                                    bucket
                                ),
                                source.key
                            )
                        end

                        -- We no longer need the source frequencies.
                        redis.call('DEL', source_bucket_frequency_key)
                    end
                end
            end
        end
    )
}


local command_parser = build_argument_parser({
    {"command", function (value)
        local command = commands[value]
        assert(command ~= nil)
        return command
    end},
})

local parsed, arguments = command_parser(ARGV)
return parsed.command(arguments)
