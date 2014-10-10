/*jshint -W024 */

(function(){
  'use strict';

  var ALL = -1;

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
      $scope.actionAll = function(){
        $modalInstance.close(ALL);
      };
      $scope.actionSelected = function(){
        $modalInstance.close(context.selectedGroupIds);
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
      var timeoutId,
          pollingCursor,
          params = app.utils.getQueryParams(),
          endpoint = getEndpoint(selectedProject, params);

      var pollForChanges = function() {
        $http.get(endpoint)
          .success(function(data, code, headers){
            if (data.length) {
              var duration = $scope.chartDuration;
              data = $.map(data, GroupModel);
              angular.forEach(data, function(group){
                group.activeChartData = group.stats[duration];
              });

              var links = app.utils.parseLinkHeader(headers('Link'));
              endpoint = links.previous;
            }

            $timeout(function(){
              $scope.groupList.extend(data);
            });
          }).finally(function(){
            timeoutId = window.setTimeout(pollForChanges, 3000);
          });
      };
      var groupList = $.map(window.groupList, GroupModel);

      $scope.groupList = new Collection(groupList, {
        sortFunc: function(data) {
          app.utils.sortArray(data, function(item){
            return [item.sortWeight];
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

      function confirmAction(options){
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
                actionLabel: options.actionLabel,
                canActionAll: options.canActionAll && $scope.selectAllActive || false
              };
            }
          }
        }).result.then(options.action);
      }

      function actionGroups(options) {
        var data = options.data || {},
            url = options.url || '/api/0/projects/' + selectedProject.id + '/groups/';
        if (options.ids !== ALL) {
          url += '?id=' + options.ids.join('&id=');
        }
        $http({
          url: url,
          method: options.method || 'PUT',
          data: data
        });
        $timeout(function(){
          var groupList = [];
          if (options.ids === ALL) {
             groupList = $scope.groupList;
          } else {
            $.each(options.ids, function(id){
              var item = groupList[groupList.indexOf({id: id})];
              groupList.push(item);
            });
          }
          $.each(groupList, function(item){
            item.version = new Date().getTime() + 10;
            $.extend(true, item, data);
          });
        });
        $('.stream-actions .chk-select-all').prop('checked', false);
        $('.group-list .chk-select').prop('checked', false);
      }

      $('.stream-actions .action-resolve').click(function(e){
        e.preventDefault();

        confirmAction({
          actionLabel: 'Resolve',
          canActionAll: true,
          action: function(selectedGroupIds){
            actionGroups({
              ids: selectedGroupIds,
              data: {status: 'resolved'}
            });
          }
        });
      });

      $('.stream-actions .action-delete').click(function(e){
        e.preventDefault();

        confirmAction({
          actionLabel: 'Delete',
          action: function(selectedGroupIds){
            actionGroups({
              ids: selectedGroupIds,
              method: 'DELETE',
            });
          }
        });
      });

      $('.stream-actions .action-bookmark').click(function(e){
        e.preventDefault();

        confirmAction({
          actionLabel: 'Bookmark',
          action: function(selectedGroupIds){
            actionGroups({
              ids: selectedGroupIds,
              data: {isBookmarked: 1}
            });
          }
        });
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
