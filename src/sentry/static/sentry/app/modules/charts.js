(function(){
  'use strict';

  function createSimpleBarChart(el, points, options) {
    // TODO: maxval could default to # of hours since first_seen / times_seen
    var $el = $(el),
        existing = $el.children(),
        maxval = 10,
        title, point, pct, child, point_width;

    if (options === undefined) {
      options = {};
    }

    for (var i=0; i<points.length; i++) {
      point = points[i];
      if (typeof(point) === "number") {
        point = points[i] = {
          y: point
        };
      } else if (point.y === undefined) {
        point = points[i] = {x: point[0], y: point[1]};
      }

      if (point.y > maxval) {
        maxval = point.y;
      }
    }

    point_width = app.utils.floatFormat(100.0 / points.length, 2) + '%';

    // TODO: we should only remove nodes that are no longer valid
    for (i=0; i<points.length; i++) {
      point = points[i];
      pct = app.utils.floatFormat(point.y / maxval * 99, 2) + '%';
      title = point.y + ' events';
      if (point.label) {
        title = title + '<br>(' + point.label + ')';
      }
      if (existing.get(i) === undefined) {
        $('<a style="width:' + point_width + ';" rel="tooltip" title="' + title + '"><span style="height:' + pct + '">' + point.y + '</span></a>').tooltip({
          placement: options.placement || 'bottom',
          html: true,
          container: 'body'
        }).appendTo($el);
      } else {
        $(existing[i]).find('span').css('height', pct).text(point.y).attr('title', (point.label || point.y));
      }
    }
  }

  angular.module('sentry.charts', [])
    .directive('barchart', function() {
      return {
        restrict: 'E',
        link: function(scope, element, attrs){
          scope.$watch(attrs.data, function(value){
            element.empty();
            createSimpleBarChart(element, value, scope.$eval(attrs.options));
          });
        }
      };
    });
}());
