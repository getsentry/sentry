/*jshint -W024 */

(function(){
  'use strict';

  function getEndpoint(selectedProject, params) {
    if (typeof(params.status) === "undefined") {
      params.status = 'unresolved';
    }
    return '/api/0/projects/' + selectedProject.id + '/groups/?' + $.param(params);
  }

  SentryApp.controller('ProjectStreamControlsCtrl', [
    '$scope', '$timeout',
    function($scope, $timeout){
      var params = app.utils.getQueryParams();

      $scope.searchDropdown = {visible: false};

      if (params.bookmarks) {
        $scope.activeButton = 'bookmarks';
      } else if (params.assigned) {
        $scope.activeButton = 'assigned';
      } else {
        $scope.activeButton = 'all';
      }

      switch ($scope.activeButton) {
        case 'bookmarks':
          $('.btn-bookmarks').addClass('active');
          break;
        case 'assigned':
          $('.btn-assigned').addClass('active');
          break;
        default:
          $('.btn-all-events').addClass('active');
      }

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
        var params = app.utils.getQueryParams();
        var endpoint = getEndpoint(selectedProject, params);
        $http.get(endpoint)
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
