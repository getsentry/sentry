(function(app, Backbone){
    "use strict";

    app.Group = Backbone.Model.extend({

        defaults: {
            tags: [],
            versions: [],
            isBookmarked: false,
            historicalData: []
        }
    });

}(app, Backbone));
