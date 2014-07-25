(function(){
  'use strict';

  app.collections = {
    ScoredList: Backbone.Collection.extend({
      comparator: function(member){
        return -member.get('score');
      }
    })
  };
}());
