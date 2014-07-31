(function(){
  'use strict';

  var broadcasts = [
    {
      showBadge: true,
      badgeText: "new",
      text: "See what's new in Sentry!",
      url: "http://blog.getsentry.com/"
    },
    {
      text: "Restrict access to projects using Access Groups"
    },
    {
      text: "Precisely control notifications with Rules"
    }
  ]

  angular.module('sentry.directives.broadcast', [])
    .directive('broadcast', function() {
      return {
        restrict: 'E',
        templateUrl: '../../templates/broadcast.html',
        controller: function () {
          this.overQuota = true; // TODO: Figure out if over quota

          this.randomBroadcast = broadcasts[Math.floor(Math.random() * broadcasts.length)];

        },
        controllerAs: "broadcasts"
      };
    });
}());
