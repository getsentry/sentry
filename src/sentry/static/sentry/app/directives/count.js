define(['app'], function(app){
  'use strict';

  var numberFormats = [
      [1000000000, 'b'],
      [1000000, 'm'],
      [1000, 'k']
  ];

  var floatFormat = function(number, places) {
      var multi = Math.pow(10, places);
      return parseInt(number * multi, 10) / multi;
  };

  var formatNumber = function(number){
      var b, x, y, o, p;

      number = parseInt(number, 10);

      for (var i=0; (b=numberFormats[i]); i++){
          x = b[0];
          y = b[1];
          o = Math.floor(number / x);
          p = number % x;
          if (o > 0) {
              if (o / 10 > 1 || !p)
                  return '' + o + y;
              return '' + floatFormat(number / x, 1) + y;
          }
      }
      return '' + number;
  };

  app.directive('count', function() {
    return function(scope, element, attrs){
      var value = scope.$eval(attrs.count);
      if (value === undefined) {
        element.text('');
      } else {
        element.text(formatNumber(value));
      }
    };
  });
});
