define([
  'app'
], function(app) {
  'use strict';

  app.classy.controller({
    inject: ['$scope', '$http', '$location', 'config'],

    init: function() {
      $scope.newOwner = null;

      $scope.isUnchanged = function(value) {
        return value === null;
      };

      $scope.saveForm = function() {
        $http.put('/api/0/teams/' + this.config.teamId + '/', {
          'owner': $scope.newOwner
        }).success(function(data){
          $location.path('/account/teams');
        });
      };
    }
  });
});
