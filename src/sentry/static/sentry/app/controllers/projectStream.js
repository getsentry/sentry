/*jshint -W024 */

(function(){
  'use strict';

  SentryApp.classy.controller({
    name: 'ProjectStreamCtrl',

    inject: ['Collection', 'selectedProject', '$http', '$scope', '$window', '$timeout'],

    init: function() {
      var self = this;

      this.$scope.groupList = new this.Collection(this.$window.groupList, {
        sortFunc: function(data) {
          app.utils.sortArray(data, function(item){
            return [new Date(item.lastSeen).getTime()];
          });
        },
        limit: 50
      });
      this.timeoutId = window.setTimeout(this.pollForChanges, 1000);

      this.$scope.$on('destroy', function(){
        window.clearTimeout(self.timeoutId);
      });

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

      this.$http.get('/api/0/projects/' + this.selectedProject.id + '/groups/')
        .success(function(data){
          self.$timeout(function(){
            self.$scope.groupList.extend(data);
          });
        }).finally(function(){
          self.timeoutId = window.setTimeout(self.pollForChanges, 1000);
        });
    }
  });
}());
