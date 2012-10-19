window.app = app = app || {}

jQuery ->

    app.User = class User extends Backbone.Model

        defaults:
            name: null
            avatar: null

        isAnonymous: ->
            not @id?

        isUser: (user) ->
            @id == user.id

    app.Project = class Project extends Backbone.Model

        defaults:
            name: null
            slug: null

    app.Group = class Group extends Backbone.Model

        defaults:
            tags: []
            versions: []
            isBookmarked: false
            historicalData: []

        getHistoricalAsString: ->
            if @historicalData then @historicalData.join(', ') else ''

        getLevelClassName: ->
            'level-' + @level