/*jshint -W024 */

define([
  'app',

  'app/utils'
], function(app, utils) {
  'use strict';

  app.classy.controller({
    name: 'ProjectStreamCtrl',

    inject: ['Collection', 'selectedProject', '$http', '$scope', '$window', '$timeout'],

    init: function() {
      this.$scope.groupList = new this.Collection(this.$window.groupList);

      this.$timeout(this.pollForChanges, 1000);

      this.setChartDuration('1d');
    },

    setChartDuration: function(duration) {
      this.$scope.chartDuration = duration;
      $.each(this.$scope.groupList, function(_, group){
        group.activeChartData = group.stats['24h'];
      });
    },

    pollForChanges: function() {
      var self = this;

      this.$http.get('/api/0/projects/' + this.selectedProject.id + '/groups/').success(function(data){
        for (var i = 0; i < data.length; i++) {
          self.$scope.groupList.unshift(data[i]);
        }
        utils.sortArray(self.$scope.groupList, function(item){
          return [new Date(item.lastSeen).getTime()];
        }).splice(50);

      }).finally(function(){
        self.$timeout(self.pollForChanges, 1000);
      });
    }
  });
});
