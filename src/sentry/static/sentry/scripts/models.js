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
        },

        updateFrom: function(member) {
            for (var key in member.attributes) {
                if (key == 'isResolved' && this.get('version') > member.get('version')) {
                    continue;
                }

                if (this.get(key) != member.get(key)) {
                    this.set(key, member.get(key));
                }
            }
        }

    });

    app.models.User = Backbone.Model.extend({

        defaults: {
        }

    });


}(app, Backbone));
