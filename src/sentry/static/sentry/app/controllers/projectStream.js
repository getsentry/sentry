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
        $.ajax({
          url: endpoint,
          method: 'GET',
          success: function(data, textStatus, jqXHR){
            if (!data.length) {
              return;
            }
            var duration = $scope.chartDuration;
            data = $.map(data, GroupModel);
            angular.forEach(data, function(group){
              group.activeChartData = group.stats[duration];
            });

            var links = app.utils.parseLinkHeader(jqXHR.getResponseHeader('Link'));
            endpoint = links.previous;

            $timeout(function(){
              $scope.groupList.extend(data);
            });
          },
          complete: function(){
            timeoutId = window.setTimeout(pollForChanges, 3000);
          }
        });
      };

      $scope.selectAllActive = false;
      $scope.multiSelected = false;
      $scope.anySelected = false;
      $('.stream-actions .chk-select-all').change(function(){
        var checked = $(this).is(':checked');

        $('.group-list .chk-select').prop('checked', checked);

        var numSelected = $('.group-list .chk-select:checked').length;

        $timeout(function(){
          $scope.selectAllActive = checked;
          $scope.anySelected = numSelected !== 0;
          $scope.multiSelected = numSelected > 1;
        });
      });

      var checkboxHandler = function(){
        var allSelected = !$('.group-list .chk-select').is(':not(:checked)'),
            numSelected = $('.group-list .chk-select:checked').length;

        $('.stream-actions .chk-select-all').prop('checked', allSelected);

        $timeout(function(){
          $scope.selectAllActive = allSelected;
          $scope.anySelected = numSelected !== 0;
          $scope.multiSelected = numSelected > 1;
        });
      };

      $scope.$watch('anySelected', function(anySelected){
        if (!anySelected) {
          $('.stream-actions .btn.action').addClass('disabled').prop('disabled', true);
        } else {
          $('.stream-actions .btn.action').removeClass('disabled').prop('disabled', false);
        }
      });

      $scope.$watch('multiSelected', function(multiSelected){
        if (!multiSelected) {
          $('.stream-actions .action-merge').addClass('disabled').prop('disabled', true);
        } else {
          $('.stream-actions .action-merge').removeClass('disabled').prop('disabled', false);
        }
      });

      // TODO(dcramer): this is pretty shitty, but I'm not sure of a good
      // way to bind the events and maintain the global status
      $scope.$watchCollection('groupList', function(){
        $timeout(function(){
          $('.group-list').undelegate('.chk-select', 'change', checkboxHandler);
          $('.group-list').delegate('.chk-select', 'change', checkboxHandler);
        });
      });

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

      var sortBy = params.sort || 'date',
          sortLabel;

      switch (sortBy) {
        case 'new':
          sortLabel = 'First Seen';
          break;
        case 'priority':
          sortLabel = 'Priority';
          break;
        case 'freq':
          sortLabel = 'Frequency';
          break;
        case 'tottime':
          sortLabel = 'Total Time Spent';
          break;
        case 'avgtime':
          sortLabel = 'Average Time Spent';
          break;
        default:
          sortLabel = 'Last Seen';
          sortBy = 'date';
      }
      $scope.sortLabel = sortLabel;

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

      $('.stream-actions .action-merge').click(function(e){
        e.preventDefault();

        confirmAction({
          actionLabel: 'Merge',
          canActionAll: true,
          action: function(selectedGroupIds){
            actionGroups({
              ids: selectedGroupIds,
              data: {merge: '1'}
            });
            // TODO(dcramer): show flash message
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
            // TODO(dcramer): show flash message
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
