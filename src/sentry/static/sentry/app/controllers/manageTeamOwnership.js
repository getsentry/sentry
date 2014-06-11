define([
  'app'
], function(app) {
  'use strict';

  app.classy.controller({
    name: 'ManageTeamOwnershipCtrl',

    inject: ['$scope', '$http', '$location', 'config'],

    init: function() {
      this.$scope.newOwner = null;

    },

    isUnchanged: function(value) {
      return value === null;
    },

    saveForm: function() {
      this.$http.put('/api/0/teams/' + this.config.teamId + '/', {
        'owner': this.$scope.newOwner
      }).success(function(data){
        this.$location.path('/account/teams');
      });
    }
  });
});
