(function(app, Backbone){
    "use strict";

    app.ScoredList = Backbone.Collection.extend({
        model: app.Group,
        comparator: function(member){
            return -member.get('score');
        }
    });
}(app, Backbone));