(function(){
  'use strict';

  angular.module('sentry.directives.broadcast', [])
    .directive('broadcast', function() {
      return {
        restrict: 'E',
        templateUrl: '../../templates/broadcast.html',
        controller: ['$http', '$scope', function($http, $scope) {
          $http.get('/api/0/broadcasts/')
            .success(function(data){
              if (data.length) {
                $scope.broadcast = data[Math.floor(Math.random() * data.length)];
              } else {
                $scope.broadcast = null;
              }
            });
        }],
        controllerAs: "broadcasts"
      };
    });
}());
