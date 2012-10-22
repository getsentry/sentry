window.app = app = window.app || {}

jQuery ->

    app.OrderedElementsView = class OrderedElementsView extends Backbone.View
        initialize: (data) ->

            _.bindAll(@)

            @loaded = data.loaded ? true
            @$wrapper = $('#' + @id)
            @$parent = $('<ul></ul>')
            @$empty = $('<li class="empty"></li>')
            if @loaded
                @empty.html('<p>There is nothing to show here.</p>')
            else
                @$empty.html('<p>Loading ...</p>')
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

        load: (data) ->
            @loaded = true
            @$empty.html('<p>There is nothing to show here.</p>')
            @extend(data) if data

        setEmpty: ->
            @$parent.html(@$empty)

        extend: (data) ->
            for item in data
                @addMember(data)

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
                else
                    $el.insertBefore($rel)

            # $el.find('.sparkline').sparkline('html', {enableTagOptions: true})

            # make sure we limit the number shown
            while @collection.length > @config.maxItems
                item = @collection.pop()


        renderMember: (member) ->
            view = new GroupView
                model: member
                id: @id + member.id

            out = view.render()
            $(out.el)

        unrenderMember: (member) ->
            $('#' + @id + member.id).remove()
            if !@$parent.find('li').length
                @setEmpty()


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
