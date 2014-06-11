define([
  'app'
], function(app) {
  'use strict';

  app.classy.controller({
    name: 'DeleteTeamCtrl',

    inject: ['$scope', '$http', 'selectedTeam'],

    init: function() {
      var $scope = this.$scope;

      $scope.newOwner = null;

      this.$http.get('/api/0/teams/' + this.selectedTeam.id + '/projects/').success(function(data){
        $scope.projectList = data;
      });
    },

    saveForm: function() {
      this.$http({
        method: 'DELETE',
        url: '/api/0/teams/' + this.selectedTeam.id + '/'
      }).success(function(data){
        window.location.href = '/account/teams/';
      });
    }
  });
});
