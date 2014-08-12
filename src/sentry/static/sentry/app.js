var SentryApp = angular.module('sentry', [
  'classy',

  'sentry.charts',
  'sentry.collection',
  'sentry.forms',

  'sentry.directives.assigneeSelector',
  'sentry.directives.clippy',
  'sentry.directives.count',
  'sentry.directives.timeSince',
  'sentry.directives.broadcast',

  'ngAnimate',
  'ui.bootstrap'
]).config(function(
  $httpProvider, $interpolateProvider, $provide
) {
  'use strict';

  // compatiblity with Django templates
  $interpolateProvider.startSymbol('<%');
  $interpolateProvider.endSymbol('%>');

  // add in Django csrf support
  $httpProvider.defaults.xsrfCookieName = 'csrftoken';
  $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';

  $provide.value('config', window.SentryConfig);
  $provide.value('selectedTeam', window.SentryConfig.selectedTeam);
  $provide.value('selectedProject', window.SentryConfig.selectedProject);

  $provide.service('projectMemberList', ['$http', 'selectedProject', function($http, selectedProject){
    return $http.get('/api/0/projects/' + selectedProject.id + '/members/');
  }]);
});
