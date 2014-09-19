/*jshint -W024 */

(function(){
  'use strict';

  function getEndpoint(selectedProject, params) {
    if (typeof(params.status) === "undefined") {
      params.status = 'unresolved';
    }
    return '/api/0/projects/' + selectedProject.id + '/groups/?' + $.param(params);
  }

  SentryApp.controller('ProjectStreamActionModalCtrl', [
    '$scope', '$modalInstance', 'context',
    function($scope, $modalInstance, context) {
      $scope.numEvents = context.selectedGroupIds.length;
      $scope.actionLabel = context.actionLabel;
      $scope.canActionAll = context.canActionAll;
      $scope.cancel = function(){
        $modalInstance.dismiss('cancel');
      };
    }
  ]);

  SentryApp.controller('ProjectStreamControlsCtrl', [
    '$scope', '$timeout',
    function($scope, $timeout){
      var params = app.utils.getQueryParams();

      $('.filter-nav .search-input').focus(function(){
        $('.search-dropdown').show();
      }).blur(function(){
        $('.search-dropdown').hide();
      });

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
    }
  ]);

  SentryApp.controller('ProjectStreamCtrl', [
    '$http', '$modal', '$scope', '$timeout', 'Collection', 'GroupModel', 'selectedProject',
    function($http, $modal, $scope, $timeout, Collection, GroupModel, selectedProject) {
      var timeoutId;
      var pollForChanges = function() {
        var params = app.utils.getQueryParams();
        var endpoint = getEndpoint(selectedProject, params);
        $http.get(endpoint)
          .success(function(data){
            var duration = $scope.chartDuration;
            data = $.map(data, GroupModel);
            angular.forEach(data, function(group){
              group.activeChartData = group.stats[duration];
            });

            $timeout(function(){
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

      $scope.selectAllActive = false;
      $('.stream-actions .chk-select-all').change(function(){
        var checked = $(this).is(':checked');
        $scope.selectAllActive = checked;
        $('.group-list .chk-select').prop('checked', checked);
      });

      $('.group-list').delegate('.chk-select', 'change', function(){
        var allSelected = !$('.group-list .chk-select').is(':not(:checked)');

        $scope.selectAllActive = allSelected;
        $('.stream-actions .chk-select-all').prop('checked', allSelected);
      });

      $('.stream-actions .action-resolve').click(function(e){
        e.preventDefault();

        var selectedGroupIds = $.map($('.group-list .chk-select:checked'), function(item){
          return $(item).val();
        });
        if (selectedGroupIds.length === 0) {
          return;
        }

        var modal = $modal.open({
          templateUrl: '/templates/action-modal.html',
          controller: 'ProjectStreamActionModalCtrl',
          resolve: {
            context: function(){
              return {
                selectAllActive: $scope.selectAllActive,
                selectedGroupIds: selectedGroupIds,
                actionLabel: 'Resolve',
                canActionAll: true
              };
            }
          }
        });
        // result.then(function(selectedItem) {
        //   $scope.selected = selectedItem;
        // }, function () {
        //   console.log('Modal dismissed at: ' + new Date());
        // });
      });

      $('.stream-actions .datepicker-box').click(function(e){
        e.preventDefault();
      });

      // we explicitly avoid $timeout here to prevent the watcher
      timeoutId = window.setTimeout(pollForChanges, 1000);
      $scope.$on('destroy', function(){
        window.clearTimeout(timeoutId);
      });

      $scope.setChartDuration('24h');
    }
  ]);
}());
