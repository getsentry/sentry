window.app = app = window.app || {}

jQuery ->

    app.ScoredList = class ScoredList extends Backbone.Collection
        model = app.Group

        comparator: (member) ->
            -member.get('score')
