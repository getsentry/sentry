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


-- Utilities

local function identity(...)
    return ...
end

local function sum(t)
    return table.ireduce(
        t,
        function (total, value)
            return total + value
        end,
        0
    )
end

local function avg(t)
    return sum(t) / #t
end

function table.count(t)
    -- Shitty O(N) table size implementation
    local n = 0
    for k in pairs(t) do
        n = n + 1
    end
    return n
end

function table.slice(t, start, stop)
    -- NOTE: ``stop`` is inclusive!
    local result = {}
    for i = start or 1, stop or #t do
        result[i - start + 1] = t[i]
    end
    return result
end

function table.get_or_set_default(t, k, f)
    local v = t[k]
    if v ~= nil then
        return v
    else
        v = f(k)
        t[k] = v
        return v
    end
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


-- Argument Parsing and Validation

local function validate_value(value)
    assert(value ~= nil, 'got nil, expected value')
    return value
end

local function validate_number(value)
    local result = tonumber(value)
    assert(result ~= nil, string.format('got nil (%q), expected number', value))
    return result
end

local function validate_integer(value)
    local result = validate_number(value)
    assert(result % 1 == 0, string.format('got float (%q), expected integer', value))
    return result
end

local function argument_parser(callback)
    if callback == nil then
        callback = identity
    end

    return function (cursor, arguments)
        return cursor + 1, callback(arguments[cursor])
    end
end

local function flag_argument_parser(flags)
    return function (cursor, arguments)
        local result = {}
        while flags[arguments[cursor]] do
            result[arguments[cursor]] = true
            cursor = cursor + 1
        end
        return cursor, result
    end
end

local function repeated_argument_parser(argument_parser, quantity_parser, callback)
    if quantity_parser == nil then
        quantity_parser = function (cursor, arguments)
            return cursor + 1, validate_integer(arguments[cursor])
        end
    end

    if callback == nil then
        callback = identity
    end

    return function (cursor, arguments)
        local results = {}
        local cursor, count = quantity_parser(cursor, arguments)
        for i = 1, count do
            cursor, results[i] = argument_parser(cursor, arguments)
        end
        return cursor, callback(results)
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

local function frequencies_argument_parser(configuration)
    return repeated_argument_parser(
        function (cursor, arguments)
            local buckets = {}
            return repeated_argument_parser(
                function (cursor, arguments)
                    buckets[validate_value(arguments[cursor])] = validate_integer(arguments[cursor + 1])
                    return cursor + 2
                end
            )(cursor, arguments), buckets
        end,
        function (cursor, arguments)
            return cursor, configuration.bands
        end
    )
end


-- Time Series Set

local TimeSeriesSet = {}

function TimeSeriesSet:new(interval, retention, timestamp, key_function, limit)
    return setmetatable({
        interval = interval,
        retention = retention,
        timestamp = timestamp,
        key_function = key_function,
        limit = limit,
    }, {__index = self})
end

function TimeSeriesSet:members()
    local results = {}
    local current = math.floor(self.timestamp / self.interval)
    local n = 0
    for index = current - self.retention, current do
        local sample = redis.call('SRANDMEMBER', self.key_function(index), self.limit)
        for i = 1, #sample do
            local member = sample[i]
            local count = results[member]
            if count ~= nil then
                results[member] = count + 1
            else
                n = n + 1
                results[member] = 1
                if n >= self.limit then
                    return results
                end
            end
        end
    end
    return results
end

function TimeSeriesSet:add(...)
    local index = math.floor(self.timestamp / self.interval)
    local key = self.key_function(index)
    local result = redis.call('SADD', key, ...)
    if result > 0 then
        redis.call('EXPIREAT', key, (index + 1 + self.retention) * self.interval)
    end
    return result
end

function TimeSeriesSet:remove(...)
    local current = math.floor(self.timestamp / self.interval)
    for index = current - self.retention, current do
        redis.call('SREM', self.key_function(index), ...)
    end
end

function TimeSeriesSet:swap(old, new)
    --[[
    Replace the "old" member wtih the "new" member in all sets where it is
    present.
    ]]--
    local current = math.floor(self.timestamp / self.interval)
    for index = current - self.retention, current do
        local key = self.key_function(index)
        if redis.call('SREM', key, old) > 0 and redis.call('SADD', key, new) > 0 then
            -- It's possible that the `SREM` operation implicitly caused this
            -- set to be deleted if it reached 0 elements, so we need to be
            -- sure to reset the TTL if we successfully added the element to
            -- the potentially empty set.
            redis.call('EXPIREAT', key, (index + 1 + self.retention) * self.interval)
        end
    end
end

function TimeSeriesSet:export(member)
    local current = math.floor(self.timestamp / self.interval)
    local results = {}
    for index = current - self.retention, current do
        if redis.call('SISMEMBER', self.key_function(index), member) == 1 then
            results[#results + 1] = index
        end
    end
    return results
end

function TimeSeriesSet:import(member, data)
    for _, index in ipairs(data) do
        local key = self.key_function(index)
        if redis.call('SADD', key, member) > 1 then
            redis.call('EXPIREAT', key, (index + 1 + self.retention) * self.interval)
        end
    end
end


-- Redis Helpers

local function redis_hash_response_iterator(response)
    local i = 1
    return function ()
        local key, value = response[i], response[i + 1]
        i = i + 2
        return key, value
    end
end


-- Key Generation

local function get_key_prefix(configuration, index)
    -- NB: The brackets around the scope allow redis cluster to shard keys
    -- using the value within the brackets, this is known as a redis hash tag.
    return string.format(
        '%s:{%s}:%s',
        configuration.namespace,
        configuration.scope,
        index
    )
end

local function get_frequency_key(configuration, index, item)
    return string.format(
        '%s:f:%s',
        get_key_prefix(configuration, index),
        item
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


-- Signature Matching

local function pack_frequency_coordinate(band, bucket)
    return struct.pack('>B', band) .. bucket
end

local function unpack_frequency_coordinate(field)
    local band, index = struct.unpack('>B', field)
    return band, string.sub(field, index)
end

local function get_bucket_membership_set(configuration, index, band, bucket)
    return TimeSeriesSet:new(
        configuration.interval,
        configuration.retention,
        configuration.timestamp,
        function (i)
            return string.format(
                '%s:m:%s:',
                get_key_prefix(configuration, index),
                i
            ) .. pack_frequency_coordinate(band, bucket)
        end,
        configuration.candidate_set_limit
    )
end

local function get_frequencies(configuration, index, item)
    local frequencies = {}
    for i = 1, configuration.bands do
        frequencies[i] = {}
    end

    local key = get_frequency_key(configuration, index, item)
    -- TODO: This needs to handle this returning no data due to TTL gracefully.
    local response = redis.call('HGETALL', key)
    for field, value in redis_hash_response_iterator(response) do
        local band, bucket = unpack_frequency_coordinate(field)
        frequencies[band][bucket] = tonumber(value)
    end

    return frequencies
end

local function set_frequencies(configuration, index, item, frequencies, expiration)
    if expiration == nil then
        expiration = configuration.timestamp + configuration.interval * configuration.retention
    end

    local key = get_frequency_key(configuration, index, item)

    for band, buckets in ipairs(frequencies) do
        for bucket, count in pairs(buckets) do
            local field = pack_frequency_coordinate(band, bucket)
            redis.call('HINCRBY', key, field, count)
        end
    end

    redis.call('EXPIREAT', key, expiration)
end

local function merge_frequencies(configuration, index, source, destination)
    local source_key = get_frequency_key(configuration, index, source)
    local destination_key = get_frequency_key(configuration, index, destination)

    local response = redis.call('HGETALL', source_key)
    if #response == 0 then
        return  -- nothing to do
    end

    for field, value in redis_hash_response_iterator(response) do
        redis.call('HINCRBY', destination_key, field, value)
    end

    local source_ttl = redis.call('TTL', source_key)
    assert(source_ttl >= 0)  -- this ttl should not be 0 unless we messed up
    redis.call('EXPIRE', destination_key, math.max(source_ttl, redis.call('TTL', destination_key)))

    redis.call('DEL', source_key)
end

local function clear_frequencies(configuration, index, item)
    local key = get_frequency_key(configuration, index, item)
    redis.call('DEL', key)
end

local function is_empty(frequencies)
    for _ in pairs(frequencies[1]) do
        return false
    end
    return true
end

local function calculate_similarity(configuration, item_frequencies, candidate_frequencies)
    if is_empty(item_frequencies) and is_empty(candidate_frequencies) then
        return -1
    elseif is_empty(item_frequencies) or is_empty(candidate_frequencies) then
        return -2
    end

    return avg(
        table.imap(
            table.izip(
                item_frequencies,
                candidate_frequencies
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
        )
    )
end

local function fetch_candidates(configuration, index, frequencies)
    local create_table = function ()
        return {}
    end

    local candidates = {}
    for band, buckets in ipairs(frequencies) do
        for bucket in pairs(buckets) do
            -- Fetch all other items that have been added to
            -- the same bucket in this band during this time
            -- period.
            local members = get_bucket_membership_set(configuration, index, band, bucket):members()
            for member in pairs(members) do
                table.get_or_set_default(candidates, member, create_table)[band] = true
            end
        end
    end

    local results = {}
    for candidate, bands in pairs(candidates) do
        results[candidate] = table.count(bands)
    end
    return results
end

local function search(configuration, parameters, limit)
    local possible_candidates = {}
    local create_table = function ()
        return {}
    end

    for i, p in ipairs(parameters) do
        for candidate, hits in pairs(fetch_candidates(configuration, p.index, p.frequencies)) do
            if hits >= p.threshold then
                table.get_or_set_default(possible_candidates, candidate, create_table)[i] = hits
            end
        end
    end

    local candidates = {}
    local i = 1
    for candidate, index_hits in pairs(possible_candidates) do
        candidates[i] = {
            key = candidate,
            num_hits = #index_hits,
            avg_hits = avg(index_hits),
        }
        i = i + 1
    end

    if limit >= 0 and #candidates > limit then
        table.sort(
            candidates,
            function (this, that)
                if this.avg_hits > that.avg_hits then
                    return true
                elseif this.avg_hits < that.avg_hits then
                    return false
                elseif this.num_hits > that.num_hits then
                    return true
                elseif this.num_hits < that.num_hits then
                    return false
                else
                    return this.key < that.key -- NOTE: reverse lex
                end
            end
        )
        candidates = table.slice(candidates, 1, limit)
    end

    local results = {}
    for i, candidate in ipairs(candidates) do
        local result = {}
        for j, p in ipairs(parameters) do
            local candidate_frequencies = get_frequencies(configuration, p.index, candidate.key)
            result[j] = string.format('%f', calculate_similarity(
                configuration,
                p.frequencies,
                candidate_frequencies
            ))
        end
        results[i] = {candidate.key, result}
    end
    return results
end


-- Command Parsing

local commands = {
    RECORD = function (configuration, cursor, arguments)
        local cursor, key, signatures = multiple_argument_parser(
            argument_parser(validate_value),
            variadic_argument_parser(
                object_argument_parser({
                    {"index", argument_parser(validate_value)},
                    {"frequencies", frequencies_argument_parser(configuration)},
                })
            )
        )(cursor, arguments)

        return table.imap(
            signatures,
            function (signature)
                set_frequencies(configuration, signature.index, key, signature.frequencies)
                for band, buckets in ipairs(signature.frequencies) do
                    for bucket in pairs(buckets) do
                        get_bucket_membership_set(configuration, signature.index, band, bucket):add(key)
                    end
                end
            end
        )
    end,
    CLASSIFY = function (configuration, cursor, arguments)
        local cursor, limit, parameters = multiple_argument_parser(
            argument_parser(validate_integer),
            variadic_argument_parser(
                object_argument_parser({
                    {"index", argument_parser(validate_value)},
                    {"threshold", argument_parser(validate_integer)},
                    {"frequencies", frequencies_argument_parser(configuration)},
                })
            )
        )(cursor, arguments)

        return search(
            configuration,
            parameters,
            limit
        )
    end,
    COMPARE = function (configuration, cursor, arguments)
        local cursor, limit, item_key = multiple_argument_parser(
            argument_parser(validate_integer),
            argument_parser(validate_value)
        )(cursor, arguments)

        local cursor, parameters = variadic_argument_parser(
            object_argument_parser({
                {"index", argument_parser(validate_value)},
                {"threshold", argument_parser(validate_integer)},
            }, function (parameter)
                parameter.frequencies = get_frequencies(
                    configuration,
                    parameter.index,
                    item_key
                )
                return parameter
            end)
        )(cursor, arguments)

        return search(
            configuration,
            parameters,
            limit
        )
    end,
    MERGE = function (configuration, cursor, arguments)
        local cursor, destination_key = argument_parser(validate_value)(cursor, arguments)
        local cursor, sources = variadic_argument_parser(
            object_argument_parser({
                {"index", argument_parser(validate_value)},
                {"key", argument_parser(validate_value)},
            }, function (entry)
                assert(entry.key ~= destination_key, 'cannot merge destination into itself')
                return entry
            end)
        )(cursor, arguments)

        for _, source in ipairs(sources) do
            local source_frequencies = get_frequencies(configuration, source.index, source.key)
            merge_frequencies(configuration, source.index, source.key, destination_key)

            for band, buckets in ipairs(source_frequencies) do
                for bucket in pairs(buckets) do
                    get_bucket_membership_set(configuration, source.index, band, bucket):swap(source.key, destination_key)
                end
            end
        end
    end,
    DELETE = function (configuration, cursor, arguments)
        local cursor, sources = variadic_argument_parser(
            object_argument_parser({
                {"index", argument_parser(validate_value)},
                {"key", argument_parser(validate_value)},
            })
        )(cursor, arguments)

        for _, source in ipairs(sources) do
            local frequencies = get_frequencies(configuration, source.index, source.key)
            clear_frequencies(configuration, source.index, source.key)

            for band, buckets in ipairs(frequencies) do
                for bucket in pairs(buckets) do
                    get_bucket_membership_set(configuration, source.index, band, bucket):remove(source.key)
                end
            end
        end
    end,
    IMPORT = function (configuration, cursor, arguments)
        --[[
        Loads data returned by the ``EXPORT`` command into the location
        specified by the ``index`` and ``key`` arguments. Data can be loaded
        into multiple indices or keys by providing additional arguments.

        If the destination specified by ``index`` and ``key`` does not exist
        (relocating data to a new key, for example), it will be created. If
        data already exists at the new destination, the imported data will be
        appended to the existing data.
        ]]--
        local cursor, entries = variadic_argument_parser(
            object_argument_parser({
                {'index', argument_parser(validate_value)},
                {'key', argument_parser(validate_value)},
                {'data', argument_parser(cmsgpack.unpack)}
            })
        )(cursor, arguments)

        return table.imap(
            entries,
            function (source)
                if #source.data == 0 then
                    return
                end

                local data, ttl = unpack(source.data)
                local frequencies = {}
                for band = 1, #data do
                    frequencies[band] = {}
                    for bucket, value in pairs(data[band]) do
                        frequencies[band][bucket] = value[1]
                        get_bucket_membership_set(configuration, source.index, band, bucket):import(source.key, value[2])
                    end
                end
                set_frequencies(configuration, source.index, source.key, frequencies, ttl)
            end
        )
    end,
    EXPORT = function (configuration, cursor, arguments)
        --[[
        Exports data that is located at the provided ``index`` and ``key`` pairs.

        Generally, this data should be treated as opaque method for extracting
        data to be provided to the ``IMPORT`` command. Exported data is
        returned in the same order as the arguments are provided.
        ]]--
        local cursor, entries = variadic_argument_parser(
            object_argument_parser({
                {'index', argument_parser(validate_value)},
                {'key', argument_parser(validate_value)},
            })
        )(cursor, arguments)

        return table.imap(
            entries,
            function (source)
                local frequency_key = get_frequency_key(configuration, source.index, source.key)
                if redis.call('EXISTS', frequency_key) < 1 then
                    return cmsgpack.pack({})
                end

                local data = {}
                local frequencies = get_frequencies(configuration, source.index, source.key)
                for band = 1, #frequencies do
                    local result = {}
                    for bucket, count in pairs(frequencies[band]) do
                        result[bucket] = {
                            count,
                            get_bucket_membership_set(configuration, source.index, band, bucket):export(source.key)
                        }
                    end
                    data[band] = result
                end

                return cmsgpack.pack({
                    data,
                    configuration.timestamp + math.max(
                        redis.call('TTL', frequency_key),
                        0
                    )  -- the TTL should always exist, but this is just to be safe
                })
            end
        )
    end,
    SCAN = function (configuration, cursor, arguments)
        local cursor, entries = variadic_argument_parser(
            object_argument_parser({
                {'index', argument_parser(validate_value)},
                {'cursor', argument_parser(validate_value)},
                {'count', argument_parser(validate_integer)}
            })
        )(cursor, arguments)
        return table.imap(
            entries,
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
    end,
}

local cursor, command, configuration = multiple_argument_parser(
    argument_parser(
        function (value)
            local command = commands[value]
            assert(command ~= nil)
            return command
        end
    ),
    object_argument_parser({
        {"timestamp", argument_parser(validate_number)},
        {"namespace", argument_parser()},
        {"bands", argument_parser(validate_integer)},
        {"interval", argument_parser(validate_integer)},
        {"retention", argument_parser(validate_integer)},  -- how many previous intervals to store (does not include current interval)
        {"candidate_set_limit", argument_parser(validate_integer)},
        {"scope", argument_parser(validate_value)},
    })
)(1, ARGV)

return command(configuration, cursor, ARGV)
