(function(){
  'use strict';

  angular.module('sentry.directives.assigneeSelector', [])
    .directive('assigneeSelector', function() {
      return {
        restrict: 'E',
        templateUrl: '/templates/assignee-selector.html',
        link: function(scope, element, attrs) {
          scope.group = scope.$eval(attrs.group);
        },
        controller: ['$scope', 'projectMemberList', function($scope, projectMemberList){
          projectMemberList.success(function(data){
            $scope.projectMemberList = data;
          });

          $scope.assignTo = function(user){
            $.ajax({
              url: '/api/0/groups/' + $scope.group.id + '/',
              method: 'PUT',
              data: {
                assignedTo: user.id
              },
              success: function(data){
                scope.group.assignedTo = user;
              }
            });
          };
        }],
        controllerAs: 'assigneeSelector'
      };
    });
}());
