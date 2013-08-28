(function(app, Backbone){
    "use strict";

    app.models = {};

    app.models.Group = Backbone.Model.extend({

        defaults: {
            count: 0,
            version: 0,
            usersSeen: null,
            tags: [],
            versions: [],
            hasSeen: false,
            isBookmarked: false,
            historicalData: []
        }

    });

}(app, Backbone));
