window.app = app = app || {}

jQuery ->

    app.GroupListView = class GroupListView extends Backbone.View
        el: '.group-list'
        model: app.Group

        initialize: (data) ->

            _.bindAll @

            @$parent = $('#' + @id)

            @collection = new app.GroupList
            @collection.add(data.members || []);
            @collection.on('add', @renderMemberInContainer)
            @collection.on('remove', @unrenderMember)
            # @collection.on('add remove', @changeMember)
            @collection.on('reset', @reSortMembers)
            @collection.sort()

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
            $el = $(@id + member.id)
            if !$el.length
                $el = @renderMember(member)

            # if the row was already present, ensure it moved
            else if $el.index() == new_pos
                return

            # top item
            if new_pos == 0
                @$parent.prepend($el)
            else
                $rel = $(@id + @collection.at(new_pos - 1))
                if !$rel.length
                    @$parent.append($el)
                else
                    @$parent.insertBefore($rel)

            # $row.find('.sparkline').sparkline('html', {enableTagOptions: true});

            # // shiny fx
            # $row.css('background-color', '#ddd').animate({backgroundColor: '#fff'}, 1200);

        renderMember: (member) ->
            view = new GroupView
                model: member
                id: @id + member.id

            out = view.render()
            $(out.el)

        unrenderMember: (member) ->
            $(@id + member.id).remove()


    app.GroupView = class GroupView extends Backbone.View
        tagName: 'li'
        className: 'group'
        template: _.template $('#group-template').html()

        initialize: ->
            _.bindAll @
            @model.on "change:count", @updateCount

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
