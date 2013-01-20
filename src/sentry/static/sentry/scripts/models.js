(function(app, Backbone){
    "use strict";

    app.models = {};

    app.models.Group = Backbone.Model.extend({

        defaults: {
            tags: [],
            versions: [],
            isBookmarked: false,
            historicalData: []
        }
    });

}(app, Backbone));
