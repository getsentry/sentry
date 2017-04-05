--[[

Count-Min Sketch
================

This provides a Redis-based implementation of the Count-Min Sketch, a
probabilistic data structure that allows counting observations of items from
high cardinality input stream in sublinear space, with the tradeoff of
potentially overcounting lower-frequency items due to hash collisions.

This implementation extends the conventional Count-Min algorithm, adding an
index that allows querying for the top N items that have been observed in the
stream. The index also serves as the primary storage, reducing storage
requirements and improving accuracy, until it's capacity is exceeded, at which
point the index data is used to initialize the estimation matrix. Once the
index capacity as been exceeded and the estimation matrix has been initialized,
the index of most frequent items is maintained using the estimates from the
matrix.

The public API consists of three main methods:

- INCR: used to record observations of items,
- ESTIMATE: used to query the number of times a specific item has been seen,
- RANKED: used to query the top N items that have been recorded in a sketch.

The named command to use is the first item passed as ``ARGV``.  The command is
followed by the accuracy and storage parameters to use when initializing a new
sketch:

- DEPTH: number of rows for the estimation matrix,
- WIDTH: number of columns for the estimation matrix,
- CAPACITY: maximum size of the index (to disable indexing entirely, set to 0.)

The ``KEYS`` provided to each command are the two keys used for sketch storage:

- index key (sorted set)
- estimation matrix key (hash of frequencies (floats), keyed by struct packed matrix coordinates)

Multiple sketches can be provided to each command by providing another set of keys, e.g.

    EVALSHA $SHA 4 1:index 1:estimates 2:index 2:estimates [...]

(Whether a command returns a single result that encompasses all sketches, or a
sequence of results that correspond to each sketch is dependent on the command
being called.)

To add two items, "foo" with a score of 1, and "bar" with a score of 2 to two
sketches with depth 5, width 64 and index capacity of 50:

    EVALSHA $SHA 4 1:i 1:e 2:i 2:e INCR 5 64 50 1 foo 2 bar

To query the top 10 items from the first sketch:

    EVALSHA $SHA 2 1:i 1:e RANKED 5 64 50 10

]]--

--[[ Helpers ]]--

local function filter(f, t)
    local result = {}
    for i, value in ipairs(t) do
        if f(value) then
            table.insert(result, value)
        end
    end
    return result
end

local function map(f, t)
    local result = {}
    for i, value in ipairs(t) do
        result[i] = f(value)
    end
    return result
end

local function head(t)
    return (
        function (head, ...)
            return head, {...}
        end
    )(unpack(t))
end

local function reduce(f, t, initializer)
    if initializer == nil then
        initializer, t = head(t)
    end

    local result = initializer
    for _, value in pairs(t) do
        result = f(result, value)
    end
    return result
end

local function sum(series)
    return reduce(
        function (x, y)
            return x + y
        end,
        series,
        0
    )
end

local function zip(items)
    local length = reduce(
        math.min,
        map(
            function (t)
                return #t
            end,
            items
        )
    )
    local results = {}
    for i = 1, length do
        local value = {}
        for j = 1, #items do
            value[j] = items[j][i]
        end
        results[i] = value
    end
    return results
end


--[[
    MurmurHash3

    This implementation of MurmurHash3 is the 32-bit variation, based on the
    example implementations here: https://en.wikipedia.org/wiki/MurmurHash
]]--
local function mmh3(key, seed)
    local c1 = 0xcc9e2d51
    local c2 = 0x1b873593
    local r1 = 15
    local r2 = 13
    local m = 5
    local n = 0xe6546b64

    local function multiply(x, y)
        -- This is required to emulate uint32 overflow correctly -- otherwise,
        -- higher order bits are simply truncated and discarded.
        return (bit.band(x, 0xffff) * y) + bit.lshift(bit.band(bit.rshift(x, 16) * y,  0xffff), 16)
    end

    local hash = bit.tobit(seed)
    local remainder = #key % 4

    for i = 1, #key - remainder, 4 do
        local k = struct.unpack('<I4', key, i)
        k = multiply(k, c1)
        k = bit.rol(k, r1)
        k = multiply(k, c2)
        hash = bit.bxor(hash, k)
        hash = bit.rol(hash, r2)
        hash = multiply(hash, m) + n
    end

    if remainder ~= 0 then
        local k1 = struct.unpack('<I' .. remainder, key, #key - remainder + 1)
        k1 = multiply(k1, c1)
        k1 = bit.rol(k1, r1)
        k1 = multiply(k1, c2)
        hash = bit.bxor(hash, k1)
    end

    hash = bit.bxor(hash, #key)
    hash = bit.bxor(hash, bit.rshift(hash, 16))
    hash = multiply(hash, 0x85ebca6b)
    hash = bit.bxor(hash, bit.rshift(hash, 13))
    hash = multiply(hash, 0xc2b2ae35)
    hash = bit.bxor(hash, bit.rshift(hash, 16))
    return hash
end


--[[ Sketch ]]--

local Sketch = {}

function Sketch:new(configuration, index, estimates)
    self.__index = self
    return setmetatable({
        configuration = configuration,
        index = index,
        estimates = estimates
    }, self)
end

function Sketch:coordinates(value)
    local coordinates = {}
    for d = 1, self.configuration.depth do
        local w = (mmh3(value, d) % self.configuration.width) + 1  -- This Kool-Aid is delicious!
        table.insert(coordinates, {d, w})
    end
    return coordinates
end

function Sketch:exists()
    return redis.call('EXISTS', self.index)
end

function Sketch:observations(coordinates)
    return tonumber(redis.call('HGET', self.estimates, struct.pack('>HH', unpack(coordinates)))) or 0
end

function Sketch:estimate(value)
    if self:exists() then
        local score = tonumber(redis.call('ZSCORE', self.index, value))
        if score ~= nil then
            return score
        end
        return reduce(
            math.min,
            map(
                function (c)
                    return self:observations(c)
                end,
                self:coordinates(value)
            )
        )
    else
        return 0
    end
end

function Sketch:increment(items)
    local results = {}
    local usage = redis.call('ZCARD', self.index)
    if self.configuration.index > usage then
        -- Add all of the items to the index. (Note that this can cause the
        -- index to temporarily grow to the size of the capacity - 1 + number
        -- of items being updated in the worst case.)
        local added = 0
        for i, item in pairs(items) do
            local value, delta = unpack(item)
            local score = tonumber(redis.call('ZINCRBY', self.index, delta, value))
            if score == delta then
                added = added + 1
            end
        end

        -- If the number of items added pushes the index to capacity, we need
        -- to initialize the sketch matrix with all of the current members of
        -- the index.
        if added + usage >= self.configuration.index then
            -- TODO: Use this data to generate the response value.
            local members = redis.call('ZRANGE', self.index, 0, -1, 'WITHSCORES')
            for i = 1, #members, 2 do
                local value = members[i]
                local score = members[i + 1]
                local coordinates = self:coordinates(value)
                local estimates = map(
                    function (c)
                        return self:observations(c)
                    end,
                    coordinates
                )
                for i, item in pairs(zip({coordinates, estimates})) do
                    local c, estimate = unpack(item)
                    local update = math.max(score, estimate)
                    if estimate ~= update then
                        redis.call('HSET', self.estimates, struct.pack('>HH', unpack(c)), update)
                    end
                end
            end

            -- Remove extra items from the index.
            redis.call('ZREMRANGEBYRANK', self.index, 0, -self.configuration.index - 1)
        end
    else
        -- Fetch the estimates for each item and update them.
        for i, item in pairs(items) do
            local value, delta = unpack(item)
            local coordinates = self:coordinates(value)
            local estimates = map(
                function (c)
                    return self:observations(c)
                end,
                coordinates
            )

            -- This uses the score from the index (if it's available) instead
            -- of the index to avoid data rot as much as possible.
            local score = (tonumber(redis.call('ZSCORE', self.index, value)) or reduce(math.min, estimates)) + delta
            for i, item in pairs(zip({coordinates, estimates})) do
                local c, estimate = unpack(item)
                local update = math.max(score, estimate)
                if estimate ~= update then
                    redis.call('HSET', self.estimates, struct.pack('>HH', unpack(c)), update)
                end
            end
            results[i] = score
        end

        if self.configuration.index > 0 then
            local added = 0
            local minimum = tonumber(redis.call('ZRANGE', self.index, 0, 0, 'WITHSCORES')[2])
            for i, item in pairs(items) do
                local score = results[i]
                -- TODO: This should also probably lexicographically sort items for consistent behavior.
                if score > minimum then
                    local value = unpack(item)
                    added = added + redis.call('ZADD', self.index, score, value)
                end
            end

            if added > 0 then
                -- Remove extra items from the index.
                redis.call('ZREMRANGEBYRANK', self.index, 0, -self.configuration.index - 1)
            end
        end
    end
    return results
end

local function response_to_table(response)
    local result = {}
    for i = 1, #response, 2 do
        result[response[i]] = response[i + 1]
    end
    return result
end

function Sketch:export()
    -- If there's no data, there's nothing meaningful to export.
    if not self:exists() then
        return cmsgpack.pack(nil)
    end
    return cmsgpack.pack({
        response_to_table(redis.call('ZRANGE', self.index, 0, -1, 'WITHSCORES')),
        response_to_table(redis.call('HGETALL', self.estimates)),
    })
end

function table.is_empty(t)
    return next(t) == nil
end

function Sketch:import(payload)
    local data = cmsgpack.unpack(payload)
    if data == nil then
        return  -- nothing to do here
    end

    local source_index, source_estimators = unpack(data)

    if table.is_empty(source_estimators) then
        -- If we're just writing the source index values (and not estimators)
        -- to the destination, we can just directly increment the sketch which
        -- will take care of destinaton estimator updates and index truncation,
        -- if necessary.
        local items = {}
        for key, value in pairs(source_index) do
            table.insert(
                items,
                {key, tonumber(value)}
            )
        end
        self:increment(items)
    else
        -- If the source does have estimators, we'll have to add those to the
        -- destination estimators and rebuild the index from the combined
        -- estimates and the known top values from both indices.
        local destination_index = response_to_table(
            redis.call('ZRANGE', self.index, 0, -1, 'WITHSCORES')
        )

        -- If this sketch doesn't yet have any estimators, we'll need to derive
        -- them from the index data before we merge in the source estimators.
        if tonumber(redis.call('EXISTS', self.estimates)) ~= 1 then
            for key, score in pairs(destination_index) do
                for _, coordinates in ipairs(self:coordinates(key)) do
                    local estimate = self:observations(coordinates)
                    if estimate == nil or tonumber(score) > estimate then
                        redis.call(
                            'HSET',
                            self.estimates,
                            struct.pack('>HH', unpack(coordinates)),
                            score
                        )
                    end
                end
            end
        end

        -- Merge in the source estimators.
        for key, value in pairs(source_estimators) do
            redis.call('HINCRBY', self.estimates, key, value)
        end

        -- Rebuild the index by using the keys from both indices and the new estimates.
        local members = {}

        for key, _ in pairs(source_index) do
            members[key] = true
        end

        for key, _ in pairs(destination_index) do
            members[key] = true
        end

        redis.call('DEL', self.index)

        for key, _ in pairs(members) do
            redis.call(
                'ZADD',
                self.index,
                reduce(
                    math.min,
                    map(
                        function (coordinates)
                            return self:observations(coordinates)
                        end,
                        self:coordinates(key)
                    )
                ),
                key
            )
        end

        -- Remove extra items from the index.
        redis.call('ZREMRANGEBYRANK', self.index, 0, -self.configuration.index - 1)
    end
end


--[[ Redis API ]]--

local Command = {}

function Command:new(fn)
    return function (keys, arguments)
        local configuration, arguments = (
            function (depth, width, index, ...)
                return {
                    -- TODO: Actually validate these.
                    depth=tonumber(depth),
                    width=tonumber(width),
                    index=tonumber(index)
                }, {...}
            end
        )(unpack(arguments))

        local sketches = {}
        for i = 1, #keys, 2 do
            table.insert(sketches, Sketch:new(
                configuration,
                keys[i],
                keys[i + 1]
            ))
        end
        return fn(sketches, arguments)
    end
end


local Router = {}

function Router:new(commands)
    return function (keys, arguments)
        local name, arguments = head(arguments)
        return commands[name:upper()](keys, arguments)
    end
end


return Router:new({

    --[[
    Increment the number of observations for each item in all sketches.
    ]]--
    INCR = Command:new(
        function (sketches, arguments)
            local items = {}
            for i = 1, #arguments, 2 do
                -- The increment value needs to be positive, since we're using the conservative
                -- update strategy proposed by Estan and Varghese:
                -- http://www.eecs.harvard.edu/~michaelm/CS223/mice.pdf
                local delta = tonumber(arguments[i])
                assert(delta > 0, 'The increment value must be positive and nonzero.')

                local value = arguments[i + 1]
                table.insert(items, {value, delta})
            end

            return map(
                function (sketch)
                    return sketch:increment(items)
                end,
                sketches
            )
        end
    ),

    --[[
    Estimate the number of observations for each item in all sketches,
    returning a sequence containing scores for items in the order that they
    were provided for each sketch.
    ]]--
    ESTIMATE = Command:new(
        function (sketches, values)
            return map(
                function (sketch)
                    return map(
                        function (value)
                            return string.format(
                                '%s',
                                sketch:estimate(value)
                            )
                        end,
                        values
                    )
                end,
                sketches
            )
        end
    ),

    --[[
    Find the most frequently observed items across all sketches, returning a
    seqeunce of item, score pairs.
    ]]--
    RANKED = Command:new(
        function (sketches, arguments)
            local limit = unpack(arguments)

            -- We only care about sketches that actually exist.
            sketches = filter(
                function (sketch)
                    return sketch:exists()
                end,
                sketches
            )

            if #sketches == 0 then
                return {}
            end

            -- TODO: There are probably a bunch of performance optimizations that could be made here.
            -- If no limit is provided, use an implicit limit of the smallest index.
            if limit == nil then
                limit = reduce(
                    math.min,
                    map(
                        function (sketch)
                            return sketch.configuration.index
                        end,
                        sketches
                    )
                )
            end

            if #sketches == 1 then
                local results = {}
                -- Note that the ZREVRANGE bounds are *inclusive*, so the limit
                -- needs to be reduced by one to act as a typical slice bound.
                local members = redis.call('ZREVRANGE', sketches[1].index, 0, limit - 1, 'WITHSCORES')
                for i=1, #members, 2 do
                    table.insert(
                        results,
                        {
                            members[i],
                            string.format('%s', members[i + 1])
                        }
                    )
                end
                return results
            else
                -- As the first pass, we need to find all of the items to look
                -- up in all sketches.
                local items = {}
                for _, sketch in pairs(sketches) do
                    local members = redis.call('ZRANGE', sketch.index, 0, -1)
                    for _, member in pairs(members) do
                        items[member] = true
                    end
                end

                local results = {}
                for value in pairs(items) do
                    table.insert(
                        results,
                        {
                            value,
                            sum(
                                map(
                                    function (sketch)
                                        return sketch:estimate(value)
                                    end,
                                    sketches
                                )
                            ),
                        }
                    )
                end

                local function comparator(x, y)
                    if x[2] == y[2] then
                        return x[1] < y[1]  -- lexicographically by key ascending
                    else
                        return x[2] > y[2]  -- score descending
                    end
                end

                table.sort(results, comparator)

                -- Trim the results to the limit.
                local trimmed = {}
                for i = 1, math.min(limit, #results) do
                    local item, score = unpack(results[i])
                    trimmed[i] = {
                        item,
                        string.format('%s', score)
                    }
                end
                return trimmed
            end
        end
    ),

    EXPORT = Command:new(
        function (sketches, arguments)
            return map(
                function (sketch)
                    return sketch:export()
                end,
                sketches
            )
        end
    ),

    IMPORT = Command:new(
        function (sketches, arguments)
            return map(
                function (item)
                    local sketch, data = unpack(item)
                    return sketch:import(data)
                end,
                zip({sketches, arguments})
            )
        end
    ),

})(KEYS, ARGV)
