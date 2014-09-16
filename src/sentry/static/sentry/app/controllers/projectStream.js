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

  SentryApp.controller('ProjectStreamCtrl', [
    '$http', '$scope', '$timeout', 'Collection', 'GroupModel', 'selectedProject',
    function($http, $scope, $timeout, Collection, GroupModel, selectedProject) {
      var timeoutId;
      var pollForChanges = function() {
        $http.get('/api/0/projects/' + selectedProject.id + '/groups/')
          .success(function(data){
            var duration = $scope.chartDuration;
            data = $.map(data, GroupModel);
            $timeout(function(){
              angular.forEach(data, function(group){
                group.activeChartData = group.stats[duration];
              });
              $scope.groupList.extend(data);
            });
          }).finally(function(){
            timeoutId = window.setTimeout(pollForChanges, 1000);
          });
      };
      var groupList = $.map(window.groupList, GroupModel);

      $scope.groupList = new Collection(groupList, {
        sortFunc: function(data) {
          app.utils.sortArray(data, function(item){
            return [item.score];
          });
        },
        canUpdate: function(current, pending) {
          return (current.version < pending.version);
        },
        limit: 50
      });

      $scope.setChartDuration = function(duration) {
        $scope.chartDuration = duration;
        angular.forEach($scope.groupList, function(group){
          group.activeChartData = group.stats[duration];
        });
      };

      // we explicitly avoid $timeout here to prevent the watcher
      timeoutId = window.setTimeout(pollForChanges, 1000);
      $scope.$on('destroy', function(){
        window.clearTimeout(timeoutId);
      });

      $scope.setChartDuration('24h');
    }
  ]);
}());
