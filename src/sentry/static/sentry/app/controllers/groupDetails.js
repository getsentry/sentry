define([
  'app'
], function(app) {
  'use strict';

  app.classy.controller({
    name: 'GroupDetailsCtrl',

    inject: ['$scope', '$http'],

    init: function() {
      // TODO(dcramer): remove the window hack
      this.$http.post('/api/0/groups/' + window.SentryConfig.selectedGroup.id + '/markseen/');
    }
  });
});

