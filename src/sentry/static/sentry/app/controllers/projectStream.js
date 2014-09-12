/*jshint -W024 */

(function(){
  'use strict';

  SentryApp.controller('ProjectStreamControlsCtrl', [
    '$scope', '$timeout',
    function($scope, $timeout){
      $scope.searchDropdown = {visible: false};

      $('.search-input').typeahead({}, {
        source: function(query, cb){
          console.log(query);
          cb([{value: query}]);
        }
      });
    }
  ]);

  SentryApp.classy.controller({
    name: 'ProjectStreamCtrl',

    inject: ['Collection', 'selectedProject', '$http', '$scope', '$window', '$timeout'],

    init: function() {
      var self = this;

      this.$scope.groupList = new this.Collection(this.$window.groupList, {
        sortFunc: function(data) {
          app.utils.sortArray(data, function(item){
            return [item.score];
          });
        },
        limit: 50
      });
      this.timeoutId = window.setTimeout(this.pollForChanges, 1000);

      this.$scope.$on('destroy', function(){
        window.clearTimeout(self.timeoutId);
      });

      this.setChartDuration('24h');
    },

    setChartDuration: function(duration) {
      this.$scope.chartDuration = duration;
      angular.forEach(this.$scope.groupList, function(group){
        group.activeChartData = group.stats[duration];
      });
    },

    pollForChanges: function() {
      var self = this;

      this.$http.get('/api/0/projects/' + this.selectedProject.id + '/groups/')
        .success(function(data){
          var duration = self.$scope.chartDuration;
          self.$timeout(function(){
            angular.forEach(data, function(group){
              group.activeChartData = group.stats[duration];
            });
            self.$scope.groupList.extend(data);
          });
        }).finally(function(){
          self.timeoutId = window.setTimeout(self.pollForChanges, 1000);
        });
    }
  });
}());
