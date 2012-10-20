window.app = app = app || {}

jQuery ->

    app.ScoredList = class ScoredList extends Backbone.Collection

        initialize: ->
            _.bindAll(@)

            model = app.Group

        comparator: (member) ->
            -member.get('score')
