(function(){
  'use strict';

  angular.module('sentry.directives.assigneeSelector', [])
    .directive('assigneeSelector', function() {
      return {
        restrict: 'E',
        templateUrl: '/templates/assignee-selector.html',
        controller: ['$scope', '$http', 'selectedProject', function($scope, $http, selectedProject){
          $http.get('/api/0/projects/' + selectedProject.id + '/members/')
            .success(function(data){
              $scope.projectMemberList = data;
            });
        }],
        controllerAs: 'assigneeSelector'
      };
    });
}());
