(function(){
  'use strict';

  angular.module('sentry.flash', [])
    .factory('flash', [
      '$rootScope', '$timeout',
      function($rootScope, $timeout){
        var messages = [],
            reset;

        var cleanup = function() {
          $timeout.cancel(reset);
          reset = $timeout(function() {
            messages = [];
          });
        };

        var emit = function() {
          $rootScope.$emit('flash:message', messages, cleanup);
        };

        $rootScope.$on('$routeChangeSuccess', emit);

        var getLevelTypeName = function(level) {
          if (level == 'error') {
            return 'danger';
          } else {
            return level;
          }
        };

        var asMessage = function(level, text) {
          if (text === undefined) {
            text = level;
            level = 'success';
          }
          return {
            type: getLevelTypeName(level),
            text: text
          };
        };

        var asArrayOfMessages = function(level, text) {
          if (level instanceof Array) return level.map(function(message) {
            return message.text ? message : asMessage(message);
          });
          return [asMessage(level, text)];
        };

        return function(level, text) {
          emit(messages = asArrayOfMessages(level, text));
        };
      }
    ])
    .directive('flashMessages', function() {
      return {
        restrict: 'E',
        replace: true,
        template:
          '<ol class="alert-list" id="flash-messages">' +
            '<li ng-repeat="m in messages" class="alert alert-{{m.type}} alert-dismissable">' +
              '<div class="container">' +
                '<button type="button" class="close" ng-click=close($index)>&times;</button>' +
                '{{m.text}}' +
              '</div>' +
            '</li>' +
          '</ol>',
        controller: function($scope, $rootScope) {
          $scope.close = function(index){
            $scope.messages.splice(index, 1);
          };

          $rootScope.$on('flash:message', function(_, messages, done) {
            $scope.messages = messages;
            done();
          });

          $rootScope.$on('$stateChangeSuccess', function(_u1, _u2, $stateParams){
            $scope.messages = [];
          });
        }
      };
    });
}());
