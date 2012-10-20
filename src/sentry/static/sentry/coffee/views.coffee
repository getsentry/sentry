window.app = app = app || {}

jQuery ->

    app.OrderedElementsView = class OrderedElementsView extends Backbone.View
        initialize: (data) ->

            _.bindAll(@)

            @$parent = $('#' + @id)

            @queue = new app.ScoredList

            @collection = new app.ScoredList
            @collection.add(data.members || []);
            @collection.on('add', @renderMemberInContainer)
            @collection.on('remove', @unrenderMember)
            # @collection.on('add remove', @changeMember)
            @collection.on('reset', @reSortMembers)
            @collection.sort()

            @realtimeEnabled = data.realtimeEnabled || true
            @poll();
            window.setInterval(@tick, 300);


        addMember: (member) ->
            if not @hasMember(member)
                @collection.add(member)
            else
                @updateMember(member)

        reSortMembers: ->
            @collection.each (member) =>
                @renderMemberInContainer(member)

        updateMember: (member) ->
            obj = @collection.get(member.id)
            obj.set('count', member.get('count'))
            obj.set('score', member.get('score'))

            @collection.sort()

        hasMember: (member) ->
            if @collection.get(member.id) then true else false

        removeMember: (member) ->
            @collection.remove(member)

        renderMemberInContainer: (member) ->
            new_pos = @collection.indexOf(member)

            # create the element if it does not yet exist
            $el = $('#' + @id + member.id)
            if !$el.length
                $el = @renderMember(member)

            # if the row was already present, ensure it moved
            else if $el.index() == new_pos
                return

            # top item
            if new_pos == 0
                @$parent.prepend($el)
            else
                $rel = $('#' + @id + @collection.at(new_pos - 1))
                if !$rel.length
                    @$parent.append($el)
                else
                    @$parent.insertBefore($rel)

        renderMember: (member) ->
            view = new GroupView
                model: member
                id: @id + member.id

            out = view.render()
            $(out.el)

        unrenderMember: (member) ->
            $('#' + @id + member.id).remove()

        tick: ->
            if !@queue.length
                return

            # ensure "no messages" is cleaned up
            $('#no_messages').remove();

            @addMember(@queue.pop())

            # $row.find('.sparkline').sparkline('html', {enableTagOptions: true});

            # # shiny fx
            # $row.css('background-color', '#ddd').animate({backgroundColor: '#fff'}, 1200);

        getPollUrl: ->
            app.config.urlPrefix + '/api/' + app.config.projectId + '/poll/'

        poll: ->
            if (!@realtimeEnabled)
                window.setTimeout(@poll, 1000);

            data = app.utils.getQueryParams()
            data.view_id = app.config.viewId || undefined;
            data.cursor = @cursor || undefined;

            $.ajax
                url: @getPollUrl()
                type: 'get'
                dataType: 'json'
                data: data
                success: (groups) =>
                    if !groups.length
                        setTimeout(@poll, 5000)
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

                    window.setTimeout(@poll, 1000)

                error: =>
                    # if an error happened lets give the server a bit of time before we poll again
                    window.setTimeout(@poll, 10000)

            # make sure we limit the number shown
            while @collection.length > 50
                item = @collection.pop()


    app.GroupListView = class GroupListView extends OrderedElementsView


    app.GroupView = class GroupView extends Backbone.View
        tagName: 'li'
        className: 'group'
        template: _.template $('#group-template').html()

        initialize: ->
            _.bindAll(@)
            @model.on("change:count", @updateCount)

        render: ->
            data = @model.toJSON()
            data.historicalData = @getHistoricalAsString @model
            @$el.html @template data
            @$el.addClass @getLevelClassName @model
            if data.isResolved
                @$el.addClass 'resolved'
            if data.historicalData
                @$el.addClass 'with-metadata'
            @$el.attr('data-id', data.id)
            @

        getHistoricalAsString: (obj) ->
            if obj.get('historicalData') then obj.get('historicalData').join ', ' else ''

        getLevelClassName: (obj) ->
            'level-' + obj.get('levelName')

        updateCount: (obj) ->
            $('.count span', this.$el).text @model.get("count")
