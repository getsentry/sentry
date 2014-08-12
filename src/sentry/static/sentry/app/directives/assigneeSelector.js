(function(){
  'use strict';

  angular.module('sentry.directives.assigneeSelector', [])
    .directive('assigneeSelector', function() {
      return {
        restrict: 'E',
        templateUrl: '/templates/assignee-selector.html',
        controller: ['$scope', 'projectMemberList', function($scope, projectMemberList){
          projectMemberList.success(function(data){
            $scope.projectMemberList = data;
          });
        }],
        controllerAs: 'assigneeSelector'
      };
    });
}());
