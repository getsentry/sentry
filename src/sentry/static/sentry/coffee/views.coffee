window.app = app = window.app || {}

jQuery ->

    app.OrderedElementsView = class OrderedElementsView extends Backbone.View
        emptyMessage: $('<p>There is nothing to show here.</p>');
        loadingMessage: $('<p>Loading...</p>');

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
            @extend(data) if data
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

        updateMember: (member) ->
            obj = @collection.get(member.id)
            if member.get('count') != obj.get('count')
                obj.set('count', member.get('count'))
            if member.get('score') != obj.get('score')
                obj.set('score', member.get('score'))

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

            $el.find('.sparkline').each (_, el) =>
                $(el).sparkline 'html'
                    enableTagOptions: true
                    height: $(el).height()

            if @loaded
                $el.css('background-color', '#ddd').animate({backgroundColor: '#fff'}, 1200)

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


    app.GroupListView = class GroupListView extends OrderedElementsView

        initialize: (data) ->
            OrderedElementsView.prototype.initialize.call(@, data)

            @config =
                realtime: data.realtime ? false
                pollUrl: data.pollUrl ? null
                pollTime: data.pollTime ? 2000
                tickTime: data.tickTime ? 300

            @queue = new app.ScoredList
            @cursor = null

            window.setInterval(@tick, @config.tickTime)

            @poll()

        tick: ->
            if !@queue.length
                return

            item = @queue.pop()
            if @config.realtime
                @addMember(item)

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
                            @queue.add(new app.Group(data))

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
            @model.on('change:isBookmarked', @render)
            @model.on('change:isResolved', @render)

        render: ->
            data = @model.toJSON()
            data.historicalData = @getHistoricalAsString(@model)
            @$el.html(@template(data))
            @$el.addClass(@getLevelClassName(@model))
            @$el.find('a[data-action=resolve]').click (e) =>
                e.preventDefault()
                @resolve(@model)
            @$el.find('a[data-action=bookmark]').click (e) =>
                e.preventDefault()
                @bookmark(@model)

            if data.isResolved
                @$el.addClass('resolved')
            if data.historicalData
                @$el.addClass('with-sparkline')
            @$el.attr('data-id', data.id)
            @

        getResolveUrl: ->
            app.config.urlPrefix + '/api/' + app.config.projectId + '/resolve/'

        resolve: (obj) ->
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

        bookmark: (obj) ->
            $.ajax
                url: @getBookmarkUrl()
                type: 'post'
                dataType: 'json'
                data:
                    gid: @model.get('id')
                success: (response) =>
                    @model.set('isBookmarked', response.bookmarked)

        getHistoricalAsString: (obj) ->
            if obj.get('historicalData') then obj.get('historicalData').join ', ' else ''

        getLevelClassName: (obj) ->
            'level-' + obj.get('levelName')

        updateCount: (obj) ->
            new_count = app.formatNumber(obj.get('count'))
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

    app.floatFormat = (number, places) ->
        multi = 10 * places
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
        return number
