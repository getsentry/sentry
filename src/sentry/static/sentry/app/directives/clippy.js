(function(){
  'use strict';

  angular.module('sentry.directives.clippy', [])
    .directive('clippy', function(config) {
      return function(scope, element, attrs){
        $(element).clippy({
          clippy_path: config.mediaUrl + 'clippy.swf',
          keep_text: true
        });
      };
    });
}());
