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

  function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var cookie = jQuery.trim(cookies[i]);
        // Does this cookie string begin with the name we want?
        if (cookie.substring(0, name.length + 1) == (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  function sameOrigin(url) {
    // url could be relative or scheme relative or absolute
    var host = document.location.host; // host + port
    var protocol = document.location.protocol;
    var sr_origin = '//' + host;
    var origin = protocol + sr_origin;
    // Allow absolute or scheme relative URLs to same origin
    return (url == origin || url.slice(0, origin.length + 1) == origin + '/') ||
        (url == sr_origin || url.slice(0, sr_origin.length + 1) == sr_origin + '/') ||
        // or any other URL that isn't scheme relative or absolute i.e relative.
        !(/^(\/\/|http:|https:).*/.test(url));
  }

  function safeMethod(method) {
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
  }

  jQuery(document).ajaxSend(function(event, xhr, settings) {
    if (!safeMethod(settings.type) && sameOrigin(settings.url)) {
      xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
    }
  });

  $provide.value('config', window.SentryConfig);
  $provide.value('selectedTeam', window.SentryConfig.selectedTeam);
  $provide.value('selectedProject', window.SentryConfig.selectedProject);

  $provide.service('projectMemberList', ['$http', 'selectedProject', function($http, selectedProject){
    return $http.get('/api/0/projects/' + selectedProject.id + '/members/');
  }]);
});
