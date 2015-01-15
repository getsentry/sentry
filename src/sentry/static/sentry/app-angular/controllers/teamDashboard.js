/*jshint -W024 */

(function(){
  'use strict';

  SentryApp.classy.controller({
    name: 'TeamDashboardCtrl',

    inject: ['$scope', '$http', '$timeout', 'Collection', 'selectedTeam'],

    init: function() {
      $('#chart').height('150px');
      app.charts.createBasic('#chart');

      var newGroupList = new this.Collection([], {limit: 5});
      var trendingGroupList = new this.Collection([], {limit: 5});

      this.loadNewGroups('1440', newGroupList);
      this.loadTrendingGroups('1440', trendingGroupList);

      this.$scope.newGroupList = newGroupList;
      this.$scope.trendingGroupList = trendingGroupList;
    },

    loadNewGroups: function(minutes, groupList) {
      var baseUrl = '/api/0/teams/' + this.selectedTeam.id + '/groups/new/';

      if (groupList === undefined) {
        groupList = this.$scope.newGroupList;
      }

      this.loadGroups(groupList, baseUrl, minutes);
    },

    loadTrendingGroups: function(minutes, groupList) {
      var baseUrl = '/api/0/teams/' + this.selectedTeam.id + '/groups/trending/';

      if (groupList === undefined) {
        groupList = this.$scope.trendingGroupList;
      }

      this.loadGroups(groupList, baseUrl, minutes);
    },

    loadGroups: function(groupList, baseUrl, minutes) {
      var url = baseUrl + '?limit=5&minutes=' + minutes,
          $scope = this.$scope,
          $http = this.$http,
          $timeout = this.$timeout;

      groupList.state = 'loading';
      groupList.selected = minutes;

      $http.get(url)
        .success(function(data) {
          $timeout(function(){
            groupList.empty();
            groupList.extend(data);
            if (groupList.length) {
              groupList.state = 'results';
            } else {
              groupList.state = 'no-results';
            }
          });
        })
        .error(function(){
          $timeout(function(){
            groupList.empty();
            groupList.state = 'error';
          });
        });
    }
  });
}());
