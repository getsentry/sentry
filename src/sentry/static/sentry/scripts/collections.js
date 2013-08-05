(function(app, Backbone){
    "use strict";

    app.ScoredList = Backbone.Collection.extend({
        comparator: function(member){
            return -member.get('score');
        }
    });
}(app, Backbone));
