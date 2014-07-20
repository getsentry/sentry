define([
  'angular',
  'app',
  'moment',
  'jquery',

  'app/controllers/default',
  'app/controllers/deleteTeam',
  'app/controllers/groupDetails',
  'app/controllers/manageTeamOwnership',
  'app/controllers/manageTeamSettings',
  'app/controllers/projectStream',
  'app/controllers/teamDashboard',

  'app/directives/count',
  'app/directives/timeSince',
], function(angular, app, moment, jQuery){
  'use strict';

  app.config(function(
    $httpProvider, $interpolateProvider, $provide
  ) {
    // compatiblity with Django templates
    $interpolateProvider.startSymbol('<%');
    $interpolateProvider.endSymbol('%>');

    // add in Django csrf support
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';

    $provide.value('config', window.SentryConfig);
    $provide.value('selectedTeam', window.SentryConfig.selectedTeam);
    $provide.value('selectedProject', window.SentryConfig.selectedProject);
  });

  // Change all select boxes to selectize elements.
  jQuery('select').selectize();

  moment.lang(window.SentryConfig.lang);

  angular.bootstrap(document, ['app']);
});
