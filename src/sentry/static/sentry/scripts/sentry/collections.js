(function(){

    window.EventList = Backbone.Collection.extend({
        model: Event,
        comparator: function(event){
            return event.get('score');
        }
    });

}());