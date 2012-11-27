window.app = app = window.app || {}

jQuery ->

    app.OrderedElementsView = class OrderedElementsView extends Backbone.View
        emptyMessage: '<p>There is nothing to show here.</p>';
        loadingMessage: '<p>Loading...</p>';

        initialize: (data) ->
            _.bindAll(@)

            @$wrapper = $('#' + @id)
            @$parent = $('<ul></ul>')
            @$empty = $('<li class="empty"></li>')
            loaded = if data.members then true else false
            if loaded
                @$empty.html(@emptyMessage)
            else
                @$empty.html(@loadingMessage)
            @setEmpty()
            @$wrapper.html(@$parent)

            if data.className
                @$parent.addClass(data.className)

            # TODO: we can use bindAll to make this more sane
            @config = 
                maxItems: data.maxItems ? 50

            @collection = new app.ScoredList
            @collection.add(data.members || []);
            @collection.on('add', @renderMemberInContainer)
            @collection.on('remove', @unrenderMember)
            # @collection.on('add remove', @changeMember)
            @collection.on('reset', @reSortMembers)
            @collection.sort()

            # we set this last as it has side effects
            @loaded = loaded

        load: (data) ->
            @$empty.html(@emptyMessage)
            if data
                @extend(data)
            else
                @setEmpty()
            @loaded = true

        setEmpty: ->
            @$parent.html(@$empty)

        extend: (data) ->
            for item in data
                @addMember(item)

        addMember: (member) ->
            if not @hasMember(member)
                if @collection.models.length >= @config.maxItems - 1
                    # bail early if the score is too low
                    if member.get('score') < @collection.last().get('score')
                        return

                    # make sure we limit the number shown
                    while @collection.models.length >= @config.maxItems
                        @collection.pop()

                @collection.add(member)
            else
                @updateMember(member)

        reSortMembers: ->
            @collection.each (member) =>
                @renderMemberInContainer(member)

        updateMember: (member, options) ->
            options ||= {}

            # TODO: is there a better way to pass both non-models and models here?
            count = member.count ? member.get('count')
            score = member.score ? member.get('score')

            existing = @collection.get(member.id)
            if existing.get('count') != count
                existing.set('count', count)

            if existing.get('score') != score
                existing.set('score', score)

            if options.sort ? true
                # score changed, resort
                @collection.sort()

        hasMember: (member) ->
            @collection.get(member.id)?

        removeMember: (member) ->
            @collection.remove(member)

        renderMemberInContainer: (member) ->
            new_pos = @collection.indexOf(member)

            @$parent.find('li.empty').remove()

            # create the element if it does not yet exist
            $el = $('#' + @id + member.id)

            if !$el.length
                $el = @renderMember(member)

            # if the row was already present, ensure it moved
            else if $el.index() is new_pos
                return

            # top item
            if new_pos is 0
                @$parent.prepend($el)
            else
                # find existing item at new position
                $rel = $('#' + @id + @collection.at(new_pos).id)
                if !$rel.length
                    @$parent.append($el)
                # TODO: why do we get here?
                else if $el.id != $rel.id
                    $el.insertBefore($rel)
                else
                    return

            if @loaded
                $el.css('background-color', '#eee').animate({backgroundColor: '#fff'}, 1200)

        renderMember: (member) ->
            view = new GroupView
                model: member
                id: @id + member.id

            out = view.render()
            out.$el

        unrenderMember: (member) ->
            $('#' + @id + member.id).remove()
            if !@$parent.find('li').length
                @setEmpty()


    app.GroupListView = class GroupListView extends app.OrderedElementsView

        initialize: (data) ->
            if !data?
                data = {}
            data.model = app.Group
            OrderedElementsView.prototype.initialize.call(@, data)

            @config =
                realtime: data.realtime ? false
                pollUrl: data.pollUrl ? null
                pollTime: data.pollTime ? 1000
                tickTime: data.tickTime ? 100

            @queue = new app.ScoredList

            @cursor = null

            @poll()

            window.setInterval(@tick, @config.tickTime)

        tick: ->
            if !@queue.length
                return

            item = @queue.pop()
            if @config.realtime
                @addMember(item)
            else
                if @hasMember(item)
                    @updateMember(item, {
                        sort: false
                    })

        poll: ->
            if !@config.realtime
                window.setTimeout(@poll, @config.pollTime)
                return

            data = app.utils.getQueryParams()
            data.cursor = @cursor || undefined

            $.ajax
                url: @config.pollUrl
                type: 'get'
                dataType: 'json'
                data: data
                success: (groups) =>
                    if !groups.length
                        setTimeout(@poll, @config.pollTime * 5)
                        return

                    @cursor = groups[groups.length - 1].score || undefined

                    for data in groups
                        obj = @queue.get(data.id)
                        if obj
                            # TODO: this code is shared in updateMember above
                            obj.set('count', data.count)
                            obj.set('score', data.score)
                            @queue.sort()
                        else
                            @queue.add(data)

                    window.setTimeout(@poll, @config.pollTime)

                error: =>
                    # if an error happened lets give the server a bit of time before we poll again
                    window.setTimeout(@poll, @config.pollTime * 10)

    app.GroupView = class GroupView extends Backbone.View
        tagName: 'li'
        className: 'group'
        template: _.template(app.templates.group)

        initialize: ->
            _.bindAll(@)
            @model.on('change:count', @updateCount)
            @model.on('change:lastSeen', @updateLastSeen)
            @model.on('change:isBookmarked', @render)
            @model.on('change:isResolved', @render)
            @model.on('change:historicalData', @renderSparkline)

        render: ->
            data = @model.toJSON()
            @$el.html(@template(data))
            @$el.attr('data-id', @model.id)
            @$el.addClass(@getLevelClassName())
            if @model.get('isResolved')
                @$el.addClass('resolved')
            if @model.get('historicalData')
                @$el.addClass('with-sparkline')
            @$el.find('a[data-action=resolve]').click (e) =>
                e.preventDefault()
                @resolve()
            @$el.find('a[data-action=bookmark]').click (e) =>
                e.preventDefault()
                @bookmark()
            @renderSparkline()
            @

        renderSparkline: (obj) ->
            data = @model.get('historicalData')
            if not data
                return

            app.createSparkline(@$el.find('.sparkline'), data)

        getResolveUrl: ->
            app.config.urlPrefix + '/api/' + app.config.projectId + '/resolve/'

        resolve: () ->
            $.ajax
                url: @getResolveUrl()
                type: 'post'
                dataType: 'json'
                data:
                    gid: @model.get('id')
                success: (response) =>
                    @model.set('isResolved', true)

        getBookmarkUrl: ->
            app.config.urlPrefix + '/api/' + app.config.projectId + '/bookmark/'

        bookmark: () ->
            $.ajax
                url: @getBookmarkUrl()
                type: 'post'
                dataType: 'json'
                data:
                    gid: @model.get('id')
                success: (response) =>
                    @model.set('isBookmarked', response.bookmarked)

        getLevelClassName: () ->
            'level-' + @model.get('levelName')

        updateLastSeen: () ->
            @$el.find('.last-seen').text(app.prettyDate(@model.get('lastSeen')))

        updateCount: () ->
            new_count = app.formatNumber(@model.get('count'))
            counter = @$el.find('.count')
            digit = counter.find('span')

            if digit.is(':animated')
                return false

            if counter.data('count') == new_count
                # We are already showing this number
                return false

            counter.data('count', new_count)

            replacement = $('<span></span>', {
                css: {
                    top: '-2.1em',
                    opacity: 0
                },
                text: new_count
            })

            # The .static class is added when the animation
            # completes. This makes it run smoother.

            digit
                .before(replacement)
                .animate({top:'2.5em', opacity:0}, 'fast', () ->
                    digit.remove()
                )

            replacement
                .delay(100)
                .animate({top:0, opacity:1}, 'fast')

    app.createSparkline = (el, bits) ->
        $el = $(el)
        # TODO: maxval could default to # of hours since first_seen / times_seen
        maxval = 10
        for bit in bits
            if bit > maxval
                maxval = bit

        # TODO: we should only remove nodes that are no longer valid
        existing = $el.find('> span')
        for n in [0..(bits.length - 1)]
            bit = bits[n]
            pct = parseInt(bit / maxval * 100, 10) + '%'

            child = existing[n]
            if !child?
                $('<span><span style="height:' + pct + '" title="' + bit + '">' + bit + '</span></span>').appendTo($el)
            else
                $(child).find('span').css('height', pct).text(bit)

    app.floatFormat = (number, places) ->
        multi = Math.pow(10, places)
        return parseInt(number * multi, 10) / multi

    app.formatNumber = (number) ->
        number = parseInt(number, 10)
        z = [
            [1000000000, 'b'],
            [1000000, 'm'],
            [1000, 'k'],
        ]
        for b in z
            x = b[0]
            y = b[1]
            o = Math.floor(number / x)
            p = number % x
            if o > 0
                if ('' + o.length) > 2 or not p
                    return '' + o + y
                return '' + @floatFormat(number / x, 1) + y
        return '' + number

    app.prettyDate = (date_str) ->
        # we need to zero out at CST
        time = Date.parse(date_str)
        now = new Date()
        now_utc = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds()
        )

        seconds = (now_utc - time) / 1000
        token = 'ago'
        time_formats = [
          [60, 'just now', 'just now'], # 60
          [120, '1 minute ago', '1 minute from now'], # 60*2
          [3600, 'minutes', 60], # 60*60, 60
          [7200, '1 hour ago', '1 hour from now'], # 60*60*2
          [86400, 'hours', 3600], # 60*60*24, 60*60
          [172800, 'yesterday', 'tomorrow'], # 60*60*24*2
          [604800, 'days', 86400], # 60*60*24*7, 60*60*24
          [1209600, 'last week', 'next week'], # 60*60*24*7*4*2
          [2419200, 'weeks', 604800], # 60*60*24*7*4, 60*60*24*7
          [4838400, 'last month', 'next month'], # 60*60*24*7*4*2
          [29030400, 'months', 2419200], # 60*60*24*7*4*12, 60*60*24*7*4
          [58060800, 'last year', 'next year'], # 60*60*24*7*4*12*2
          [2903040000, 'years', 29030400], # 60*60*24*7*4*12*100, 60*60*24*7*4*12
          [5806080000, 'last century', 'next century'], # 60*60*24*7*4*12*100*2
          [58060800000, 'centuries', 2903040000] # 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
        ]
        list_choice = 1

        if seconds < 0
            seconds = Math.abs(seconds)
            token = 'from now'
            list_choice = 2

        for format in time_formats
            if seconds < format[0]
                if (typeof format[2] == 'string')
                    return format[list_choice]
                else
                    return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token

        return time
        