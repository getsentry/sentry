window.app = app = app || {}

jQuery ->

    app.GroupList = class GroupList extends Backbone.Collection

        model: app.Group
