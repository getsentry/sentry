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
      $scope.actionLabel = context.actionLabel.replace('{count}', $scope.numEvents);
      $scope.confirmLabel = context.confirmLabel;
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
    '$http', '$modal', '$scope', '$timeout', 'Collection', 'flash', 'GroupModel', 'selectedProject',
    function($http, $modal, $scope, $timeout, Collection, flash, GroupModel, selectedProject) {
      var timeoutId,
          pollingCursor,
          params = app.utils.getQueryParams(),
          endpoint = getEndpoint(selectedProject, params);

      var pollForChanges = function() {
        if (!$scope.pollingActive) {
          timeoutId = window.setTimeout(pollForChanges, 3000);
          return;
        }

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

      $scope.pollingActive = true;
      $('.stream-actions .realtime-control').click(function(){
        var $icon = $(this).find('.icon');
        if ($scope.pollingActive) {
          $icon.removeClass('icon-pause');
          $icon.addClass('icon-play');
        } else {
          $icon.addClass('icon-pause');
          $icon.removeClass('icon-play');
        }
        $scope.pollingActive = !$scope.pollingActive;
      });

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
        equals: function(self, other) {
          return self.id === other.id;
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

      function defaultActionLabel(confirmLabel) {
        return confirmLabel.toLowerCase() + ' these {count} events';
      }

      function confirmAction(options){
        var selectedGroupIds = $.map($('.group-list .chk-select:checked'), function(item){
          return $(item).val();
        });
        if (selectedGroupIds.length === 0) {
          return;
        }

        var shouldConfirm = true;
        // if skipConfirm is set we never actually show the modal
        if (options.skipConfirm === true) {
          shouldConfirm = false;
        // if onlyIfBulk is set and we've selected a single item, we skip
        // showing the modal
        } else if (options.onlyIfBulk === true && !$scope.selectAllActive) {
          shouldConfirm = false;
        }

        if (!shouldConfirm) {
          return options.action(selectedGroupIds);
        }

        if (typeof options.confirmLabel === 'undefined') {
          options.confirmLabel = 'Edit';
        }

        var modal = $modal.open({
          templateUrl: '/templates/action-modal.html',
          controller: 'ProjectStreamActionModalCtrl',
          resolve: {
            context: function(){
              return {
                selectAllActive: $scope.selectAllActive,
                selectedGroupIds: selectedGroupIds,
                actionLabel: options.actionLabel || defaultActionLabel(options.confirmLabel),
                confirmLabel: options.confirmLabel,
                canActionAll: options.canActionAll && $scope.selectAllActive || false
              };
            }
          }
        }).result.then(options.action);
      }

      function collectGroups(selection) {
        var groupList = [];
        if (selection === ALL) {
           groupList = $scope.groupList;
        } else {
          $.each(selection, function(_, id){
            var idx = $scope.groupList.indexOf({id: id});
            if (idx === -1) {
              return;
            }
            groupList.push($scope.groupList[idx]);
          });
        }
        return groupList;
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
          groupList = collectGroups(options.ids);
          $.each(groupList, function(_, item){
            item.version = new Date().getTime() + 10;
            $.extend(true, item, data);
          });

          if (typeof options.success !== "undefined") {
            options.success(groupList);
          }
        });
        $('.stream-actions .chk-select-all').prop('checked', false);
        $('.group-list .chk-select').prop('checked', false);
      }

      $('.stream-actions .action-resolve').click(function(e){
        e.preventDefault();

        confirmAction({
          confirmLabel: 'Resolve',
          canActionAll: true,
          onlyIfBulk: true,
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
          confirmLabel: 'Merge',
          action: function(selectedGroupIds){
            actionGroups({
              ids: selectedGroupIds,
              data: {merge: '1'},
              success: function() {
                flash('success', 'The selected events have been scheduled to merge.');
              }
            });
          }
        });
      });

      $('.stream-actions .action-delete').click(function(e){
        e.preventDefault();

        confirmAction({
          confirmLabel: 'Delete',
          action: function(selectedGroupIds){
            actionGroups({
              ids: selectedGroupIds,
              method: 'DELETE',
              success: function() {
                flash('success', 'The selected events have been scheduled for deletion.');
              }
            });
          }
        });
      });

      $('.stream-actions .action-bookmark').click(function(e){
        e.preventDefault();

        confirmAction({
          neverConfirm: true,
          onlyIfBulk: true,
          confirmLabel: 'Bookmark',
          action: function(selectedGroupIds){
            actionGroups({
              ids: selectedGroupIds,
              data: {isBookmarked: 1}
            });
          }
        });
      });

      $('.stream-actions .action-remove-bookmark').click(function(e){
        e.preventDefault();

        confirmAction({
          neverConfirm: true,
          onlyIfBulk: true,
          actionLabel: 'remove these {count} events from your bookmarks',
          action: function(selectedGroupIds){
            actionGroups({
              ids: selectedGroupIds,
              data: {isBookmarked: 0}
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
