window.app = app = app || {}

jQuery ->

    app.GroupListView = class GroupListView extends Backbone.View
        el: '.group-list'
        model: app.Group

        initialize: (data) ->

            _.bindAll @

            @collection = new app.GroupList
            @collection.on 'add', @appendMember
            @collection.on 'remove', @clearMember
            # @collection.on 'add remove', @changed

            for obj in data.members
                inst = new @model(obj)
                @addMember(inst)


        changed: ->
            @trigger "membership"

        addMember: (obj) ->
            if not @hasMember(obj)
                @collection.add obj
            else
                obj = @collection.get obj.id
                obj.set('count', obj.get "count")

        hasMember: (obj) ->
            if @collection.get obj.id then true else false

        removeMember: (obj) ->
            @collection.remove obj

        appendMember: (obj) ->
            view = new GroupView
                model: obj
                id: @id + obj.id

            out = view.render()
            $('#' + @id).append out.el

        clearMember: (obj) ->
            $('li[data-id="' + @id + '"]', el).remove()


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
            if obj.historicalData then obj.historicalData.join ', ' else ''

        getLevelClassName: (obj) ->
            'level-' + obj.attributes.levelName

        updateCount: (obj) ->
            $('.count span', this.$el).text @model.get("count")
