(function(){
  'use strict';

  angular.module('sentry.directives.assigneeSelector', [
    'sentry.flash',
    'ui.bootstrap'
  ]).directive('assigneeSelector', function() {
    return {
      restrict: 'E',
      templateUrl: '/templates/assignee-selector.html',
      link: function(scope, element, attrs) {
        scope.group = scope.$eval(attrs.group);
      },
      controller: [
        '$scope', '$timeout', 'flash', 'projectMemberList',
        function($scope, $timeout, flash, projectMemberList){
          projectMemberList.success(function(data){
            $scope.projectMemberList = data;
          });

          $scope.assignTo = function(user){
            $.ajax({
              url: '/api/0/groups/' + $scope.group.id + '/',
              method: 'PUT',
              data: JSON.stringify({
                assignedTo: user.email
              }),
              contentType: 'application/json',
              success: function(data){
                $timeout(function(){
                  $scope.group.assignedTo = user;
                });
              },
              error: function(){
                flash('error', 'Unable to change assignee. Please try again.');
              }
            });
          };
        }
      ],
      controllerAs: 'assigneeSelector'
    };
  });
}());
