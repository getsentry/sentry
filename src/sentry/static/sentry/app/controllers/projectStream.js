/*jshint -W024 */

(function(){
  'use strict';

  SentryApp.classy.controller({
    name: 'ProjectStreamCtrl',

    inject: ['Collection', 'selectedProject', '$http', '$scope', '$window', '$timeout'],

    init: function() {
      var self = this;

      this.$scope.groupList = new this.Collection(this.$window.groupList);
      this.timeoutId = null;

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

      this.$http.get('/api/0/projects/' + this.selectedProject.id + '/groups/').success(function(data){
        for (var i = 0; i < data.length; i++) {
          self.$scope.groupList.unshift(data[i]);
        }
        app.utils.sortArray(self.$scope.groupList, function(item){
          return [new Date(item.lastSeen).getTime()];
        }).splice(50);

      }).finally(function(){
        self.timeoutId = window.setTimeout(self.pollForChanges, 1000);
      });
    }
  });
}());
