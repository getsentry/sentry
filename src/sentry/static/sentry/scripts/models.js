(function(app, Backbone){
    "use strict";

    app.models = {};

    app.models.Group = Backbone.Model.extend({

        defaults: {
            count: 0,
            version: 0,
            tags: [],
            versions: [],
            isBookmarked: false,
            historicalData: []
        }

    });

}(app, Backbone));
