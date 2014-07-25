/*jshint -W024 */

(function(){
  'use strict';

  SentryApp.classy.controller({
    name: 'TeamDashboardCtrl',

    init: function() {
      $('#chart').height('150px');
      app.charts.createBasic('#chart');
    }
  });
}());
