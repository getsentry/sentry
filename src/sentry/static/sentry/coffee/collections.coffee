window.app = app = app || {}

jQuery ->

    app.ScoredList = class ScoredList extends Backbone.Collection
        model = app.Group

        comparator: (member) ->
            -member.get('score')
