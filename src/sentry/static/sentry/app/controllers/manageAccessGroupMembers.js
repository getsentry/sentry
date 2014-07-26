(function(){
  'use strict';

  SentryApp.classy.controller({
    name: 'ManageAccessGroupMembersCtrl',

    inject: ['$scope'],

    init: function() {
      // TODO(dcramer): replace with directive
      app.utils.makeSearchableUsersInput('form input[name=user]');
    }
  });
}());
