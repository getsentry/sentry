(function(){
  'use strict';

  angular.module('sentry.controllers.manageTeamSettings', ['classy'])
    .classy.controller({
      name: 'ManageTeamSettingsCtrl',

      inject: ['$scope', '$http', 'selectedTeam'],

      init: function() {
        this.$scope.teamData = {
          name: this.selectedTeam.name,
          slug: this.selectedTeam.slug
        };
      },

      isUnchanged: function() {
        for (var name in this.$scope.teamData) {
          if (this.selectedTeam[name] != this.$scope.teamData[name]) {
            return false;
          }
        }
        return true;
      },

      saveForm: function() {
        this.$http.put('/api/0/teams/' + this.selectedTeam.id + '/', this.$scope.teamData)
          .success(function(data){
            window.location.href = '/account/teams/' + data.slug + '/settings';
          });
      }
    });
}());
