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

-- Try and enable script effects replication if we're using Redis 3.2 or
-- greater. This is wrapped in `pcall` so that we can continue to support older
-- Redis versions while using this feature if it's available.
if not pcall(redis.replicate_commands) then
    redis.log(redis.LOG_DEBUG, 'Could not enable script effects replication.')
end

local function identity(value)
    return value
end

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
    return function (arguments, offset)
        if offset == nil then
            offset = 0
        end
        local results = {}
        for i = 1, #fields do
            local name, parser = unpack(fields[i])
            local value = arguments[i]
            local ok, result = pcall(parser, value)
            if not ok then
                error(string.format('received invalid argument for %q in position %s with value %q; %s', name, offset + i, value, result))
            else
                results[name] = result
            end
        end
        return results, table.slice(arguments, #fields + 1)
    end
end

local function build_variadic_argument_parser(fields, validator)
    if validator == nil then
        validator = identity
    end
    local parser = build_argument_parser(fields)
    return function (arguments, offset)
        if offset == nil then
            offset = 0
        end
        if #arguments % #fields ~= 0 then
            -- TODO: make this error less crummy
            error('invalid number of arguments')
        end
        local results = {}
        for i = 1, #arguments, #fields do
            local value, _ = parser(table.slice(arguments, i, i + #fields - 1), i)
            table.insert(
                results,
                validator(value)
            )
        end
        return results
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
    return (
        (index + 1)  -- upper bound of this interval
        + retention
    ) * interval
end


-- Redis Helpers

local function redis_hgetall_response_to_table(response, value_type)
    if value_type == nil then
        value_type = identity
    end
    local result = {}
    for i = 1, #response, 2 do
        result[response[i]] = value_type(response[i + 1])
    end
    return result
end


-- Generic Configuration

local configuration_parser = build_argument_parser({
    {"timestamp", parse_integer},
    {"namespace", identity},
    {"bands", parse_integer},
    {"interval", parse_integer},
    {"retention", parse_integer},  -- how many previous intervals to store (does not include current interval)
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

local function get_key_prefix(configuration, index)
    return string.format(
        '%s:%s:%s',
        configuration.namespace,
        configuration.scope,
        index
    )
end

local function get_bucket_frequency_key(configuration, index, time, band, item)
    return string.format(
        '%s:f:%s:%s:%s',
        get_key_prefix(configuration, index),
        time,
        band,
        item
    )
end

local function get_bucket_membership_key(configuration, index, time, band, bucket)
    return string.format(
        '%s:m:%s:%s:%s',
        get_key_prefix(configuration, index),
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

local function collect_index_key_pairs(arguments, validator)
    return build_variadic_argument_parser({
        {"index", identity},
        {"key", identity},
    }, validator)(arguments)
end


-- Signature Matching

local function parse_signatures(configuration, arguments)
    --[[
    Parses signatures from an argument table, collecting signatures until the
    end of the table is reached. Signatures are expected to be an index name,
    followed by the number of items specified by the `configuration.bands`
    value. Signatures are returned as a table with an `index` key (string) and
    a `buckets` key (table of strings).
    ]]--
    local entries = table.ireduce(
        arguments,
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

    return entries.completed
end

local function fetch_candidates(configuration, time_series, index, frequencies)
    --[[
    Fetch all possible keys that share some characteristics with the provided
    frequencies. The frequencies should be structured as an array-like table,
    with one table for each band that represents the number of times that
    bucket has been associated with the target object. (This is also the output
    structure of `fetch_bucket_frequencies`.) For example, a four-band
    request with two recorded observations may be strucured like this:

    {
        {a=1, b=1},
        {a=2},
        {b=2},
        {a=1, d=1},
    }

    Results are returned as table where the keys represent candidate keys.
    ]]--
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
                        configuration,
                        index,
                        time,
                        band,
                        bucket
                    )
                )
                for _, member in ipairs(members) do
                    -- TODO: Count the number of bands that we've collided in
                    -- to allow setting thresholds here.
                    candidates[member] = true
                end
            end
        end
    end
    return candidates
end

local function fetch_bucket_frequencies(configuration, time_series, index, key)
    --[[
    Fetches all of the bucket frequencies for a key from a specific index from
    all active time series chunks. This returns an array-like table that
    contains one table for each band that maps bucket identifiers to counts
    across the entire time series.
    ]]--
    return table.imap(
        range(1, configuration.bands),
        function (band)
            return table.ireduce(
                table.imap(
                    time_series,
                    function (time)
                        return redis_hgetall_response_to_table(
                            redis.call(
                                'HGETALL',
                                get_bucket_frequency_key(
                                    configuration,
                                    index,
                                    time,
                                    band,
                                    key
                                )
                            ),
                            tonumber
                        )
                    end
                ),
                function (result, response)
                    for bucket, count in pairs(response) do
                        result[bucket] = (result[bucket] or 0) + count
                    end
                    return result
                end,
                {}
            )
        end
    )
end

local function calculate_similarity(configuration, item_frequencies, candidate_frequencies)
    --[[
    Calculate the similarity between an item's frequency and an array-like
    table of candidate frequencies. This returns a table of candidate keys to
    and [0, 1] scores where 0 is totally dissimilar and 1 is exactly similar.
    ]]--
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
                            -- We calculate the "similarity" between two items
                            -- by comparing how often their contents exist in
                            -- the same buckets for a band.
                            local dist = get_manhattan_distance(
                                scale_to_total(v[1]),
                                scale_to_total(v[2])
                            )
                            -- Since this is a measure of similarity (and not
                            -- distance) we normalize the result to [0, 1]
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
    return results
end

local function fetch_similar(configuration, time_series, index, item_frequencies)
    --[[
    Fetch the items that are similar to an item's frequencies (as returned by
    `fetch_bucket_frequencies`), returning a table of similar items keyed by
    the candidate key where the value is on a [0, 1] similarity scale.
    ]]--
    local candidates = fetch_candidates(configuration, time_series, index, item_frequencies)
    local candidate_frequencies = {}
    for candidate_key, _ in pairs(candidates) do
        candidate_frequencies[candidate_key] = fetch_bucket_frequencies(
            configuration,
            time_series,
            index,
            candidate_key
        )
    end

    return calculate_similarity(
        configuration,
        item_frequencies,
        candidate_frequencies
    )
end

-- Command Parsing

local commands = {
    RECORD = takes_configuration(
        function (configuration, arguments)
            local key = arguments[1]
            local signatures = parse_signatures(
                configuration,
                table.slice(arguments, 2)
            )

            local time = math.floor(configuration.timestamp / configuration.interval)
            local expiration = get_index_expiration_time(
                configuration.interval,
                configuration.retention,
                time
            )

            return table.imap(
                signatures,
                function (entry)
                    local results = {}

                    for band, bucket in ipairs(entry.buckets) do
                        local bucket_membership_key = get_bucket_membership_key(
                            configuration,
                            entry.index,
                            time,
                            band,
                            bucket
                        )
                        redis.call('SADD', bucket_membership_key, key)
                        redis.call('EXPIREAT', bucket_membership_key, expiration)

                        local bucket_frequency_key = get_bucket_frequency_key(
                            configuration,
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
    CLASSIFY = takes_configuration(
        function (configuration, arguments)
            local signatures = parse_signatures(
                configuration,
                arguments
            )
            local time_series = get_active_indices(
                configuration.interval,
                configuration.retention,
                configuration.timestamp
            )

            return table.imap(
                signatures,
                function (signature)
                    local results = fetch_similar(
                        configuration,
                        time_series,
                        signature.index,
                        table.imap(
                            signature.buckets,
                            function (band)
                                local item = {}
                                item[band] = 1
                                return item
                            end
                        )
                    )

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
    COMPARE = takes_configuration(
        function (configuration, arguments)
            local item_key = arguments[1]
            local indices = table.slice(arguments, 2)

            local time_series = get_active_indices(
                configuration.interval,
                configuration.retention,
                configuration.timestamp
            )

            return table.imap(
                indices,
                function (index)
                    local results = fetch_similar(
                        configuration,
                        time_series,
                        index,
                        fetch_bucket_frequencies(
                            configuration,
                            time_series,
                            index,
                            item_key
                        )
                    )

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
            local sources = collect_index_key_pairs(
                table.slice(arguments, 2),
                function (entry)
                    assert(entry.key ~= destination_key, 'cannot merge destination into itself')
                    return entry
                end
            )

            local time_series = get_active_indices(
                configuration.interval,
                configuration.retention,
                configuration.timestamp
            )

            for _, source in ipairs(sources) do
                for band = 1, configuration.bands do
                    for _, time in ipairs(time_series) do
                        local source_bucket_frequency_key = get_bucket_frequency_key(
                            configuration,
                            source.index,
                            time,
                            band,
                            source.key
                        )
                        local destination_bucket_frequency_key = get_bucket_frequency_key(
                            configuration,
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

                        local response = redis_hgetall_response_to_table(
                            redis.call(
                                'HGETALL',
                                source_bucket_frequency_key
                            ),
                            tonumber
                        )

                        for bucket, count in pairs(response) do
                            -- Remove the source from the bucket membership
                            -- set, and add the destination to the membership
                            -- set.
                            local bucket_membership_key = get_bucket_membership_key(
                                configuration,
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

                        -- TODO: We only need to do this if the bucket has contents.
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
            local sources = collect_index_key_pairs(arguments)
            local time_series = get_active_indices(
                configuration.interval,
                configuration.retention,
                configuration.timestamp
            )

            for _, source in ipairs(sources) do
                for band = 1, configuration.bands do
                    for _, time in ipairs(time_series) do
                        local source_bucket_frequency_key = get_bucket_frequency_key(
                            configuration,
                            source.index,
                            time,
                            band,
                            source.key
                        )

                        local buckets = redis.call(
                            'HKEYS',
                            source_bucket_frequency_key
                        )

                        for _, bucket in ipairs(buckets) do
                            redis.call(
                                'SREM',
                                get_bucket_membership_key(
                                    configuration,
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
    ),
    IMPORT = takes_configuration(
        --[[
        Loads data returned by the ``EXPORT`` command into the location
        specified by the ``index`` and ``key`` arguments. Data can be loaded
        into multiple indices or keys by providing additional arguments.

        If the destination specified by ``index`` and ``key`` does not exist
        (relocating data to a new key, for example), it will be created. If
        data already exists at the new destination, the imported data will be
        appended to the existing data.
        ]]--
        function (configuration, arguments)
            local entries = build_variadic_argument_parser({
                {'index', identity},
                {'key', identity},
                {'data', cmsgpack.unpack},
            })(arguments)

            for _, entry in ipairs(entries) do
                for band, data in ipairs(entry.data) do
                    for _, item in ipairs(data) do
                        local time, buckets = item[1], item[2]
                        local expiration_time = get_index_expiration_time(
                            configuration.interval,
                            configuration.retention,
                            time
                        )
                        local destination_bucket_frequency_key = get_bucket_frequency_key(
                            configuration,
                            entry.index,
                            time,
                            band,
                            entry.key
                        )

                        for bucket, count in pairs(buckets) do
                            local bucket_membership_key = get_bucket_membership_key(
                                configuration,
                                entry.index,
                                time,
                                band,
                                bucket
                            )
                            redis.call('SADD', bucket_membership_key, entry.key)
                            redis.call('EXPIREAT', bucket_membership_key, expiration_time)

                            redis.call(
                                'HINCRBY',
                                destination_bucket_frequency_key,
                                bucket,
                                count
                            )
                        end

                        -- The destination bucket frequency key may have not
                        -- existed previously, so we need to make sure we set
                        -- the expiration on it in case it is new. (We only
                        -- have to do this if there we changed any bucket counts.)
                        if next(buckets) ~= nil then
                            redis.call(
                                'EXPIREAT',
                                destination_bucket_frequency_key,
                                expiration_time
                            )
                        end
                    end
                end
            end
        end
    ),
    EXPORT = takes_configuration(
        --[[
        Exports data that is located at the provided ``index`` and ``key`` pairs.

        Generally, this data should be treated as opaque method for extracting
        data to be provided to the ``IMPORT`` command. Exported data is
        returned in the same order as the arguments are provided. Each item is
        a messagepacked blob that is at the top level list, where each member
        represents the data contained within one band.  Each item in the band
        list is another list, where each member represents one time series
        interval. Each item in the time series list is a tuple containing the
        time series index and a mapping containing the counts for each bucket
        within the interval. (Due to the Lua data model, an empty mapping will
        be represented as an empty list. The consumer of this data must convert
        it back to the correct type.)
        ]]--
        function (configuration, arguments)
            local bands = range(1, configuration.bands)
            local time_series = get_active_indices(
                configuration.interval,
                configuration.retention,
                configuration.timestamp
            )
            return table.imap(
                collect_index_key_pairs(arguments),
                function (source)
                    return cmsgpack.pack(
                        table.imap(
                            bands,
                            function (band)
                                return table.imap(
                                    time_series,
                                    function (time)
                                        return {
                                            time,
                                            redis_hgetall_response_to_table(
                                                redis.call(
                                                    'HGETALL',
                                                    get_bucket_frequency_key(
                                                        configuration,
                                                        source.index,
                                                        time,
                                                        band,
                                                        source.key
                                                    )
                                                ),
                                                tonumber
                                            ),
                                        }
                                    end
                                )
                            end
                        )
                    )
                end
            )
        end
    ),
    SCAN = takes_configuration(
        function (configuration, arguments)
            local arguments = build_variadic_argument_parser({
                {"index", identity},
                {"cursor", identity},
                {"count", identity},
            })(arguments)
            return table.imap(
                arguments,
                function (argument)
                    return redis.call(
                        'SCAN',
                        argument.cursor,
                        'MATCH',
                        string.format(
                            '%s:*',
                            get_key_prefix(
                                configuration,
                                argument.index
                            )
                        ),
                        'COUNT',
                        argument.count
                    )
                end
            )
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
