(function(){
  'use strict';

  var options = {
    'width': 14,
    'height': 14,
    'color': '#ffffff'
  };

  function doesHaveFlash() {
    try
    {
      var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
      if (fo)
      {
        return true;
      }
    }
    catch(e)
    {
      if (navigator.mimeTypes ["application/x-shockwave-flash"] !== undefined)
      {
        return true;
      }
    }
    return false;
  }

  angular.module('sentry.directives.clippy', [])
    .directive('clippy', function(config) {
      return function(scope, element, attrs){
        if (!doesHaveFlash()) {
          return;
        }

        var rawText = element.text(),
            encodedText = encodeURIComponent(rawText),
            clippyPath = config.mediaUrl + 'clippy.swf',
            id = element.id;

        var params = {
            allowScriptAccess: "always",
            quality: "high",
            scale: "noscale",
            bgcolor: options.color,
            FlashVars: 'text=' + encodedText
        };

        var embedParams = angular.copy(params);
        embedParams.src = clippyPath;
        embedParams.width = options.width;
        embedParams.height = options.height;

        delete params.movie;

        var obj = angular.element('<object/>').attr({
          classid: 'clsid:d27cdb6e-ae6d-11cf-96b8-444553540000',
          width: options.width,
          height: options.height
        });

        angular.forEach(params, function(key, value){
          obj.append(angular.element('<param/>').attr({
            name: key,
            value: value
          }));
        });

        obj.append(angular.element('<embed/>').attr(embedParams));

        element.prepend(obj);
      };
    });
}());
