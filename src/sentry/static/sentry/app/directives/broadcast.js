(function(){
  'use strict';

  var broadcasts = [
    {
      badge: true,
      message: "See what's new in Sentry!",
      url: "http://blog.getsentry.com/"
    },
    {
      message: "Restrict access to projects using Access Groups"
    },
    {
      message: "Precisely control notifications with Rules"
    }
  ];

  angular.module('sentry.directives.broadcast', [])
    .directive('broadcast', function() {
      return {
        restrict: 'E',
        templateUrl: '../../templates/broadcast.html',
        controller: function () {
          this.overQuota = false; // TODO: Figure out if over quota

          this.randomBroadcast = broadcasts[Math.floor(Math.random() * broadcasts.length)];

        },
        controllerAs: "broadcasts"
      };
    });
}());
