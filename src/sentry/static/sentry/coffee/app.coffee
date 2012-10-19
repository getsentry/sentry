window.app = app = app || {}
app.config = app.config || {};

jQuery ->

    app.StreamView = class StreamView extends Backbone.View
        el: $('body')

        initialize: (data) ->

            group_list = new app.GroupListView
                id: 'event_list'
                members: data.groups


# We're not talking to the server
Backbone.sync = (method, model, success, error) ->

    success()