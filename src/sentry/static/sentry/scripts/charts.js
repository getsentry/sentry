/*global Sentry:true*/

(function(app, Backbone, jQuery, _){
    "use strict";

    var $ = jQuery;

    app.charts = {

        render: function(el) {
            var $el = $('#chart');
            var url = $el.attr('data-api-url');

            $el.height($el.parent().height());
            $.ajax({
                url: $el.attr('data-api-url'),
                type: 'get',
                dataType: 'json',
                data: {
                    days: 7,
                    gid: $el.attr('data-group') || undefined
                },
                success: function(resp) {
                    $el.empty();
                    var data = [];
                    $.each(resp, function(_, val){
                        data.push({
                            y: val[1],
                            label: app.utils.prettyDate(new Date(val[0]))
                        });
                    });
                    app.charts.createSparkline($el, data);
                }
            });
        },

        createSparkline: function(el, points){
            // TODO: maxval could default to # of hours since first_seen / times_seen
            var $el = $(el),
                existing = $el.find('> span'),
                maxval = 10,
                point, pct, child, point_width;

            for (var i=0; i<points.length; i++) {
                point = points[i];
                if (typeof(point) === "number") {
                    point = points[i] = {
                        y: point
                    };
                }
                if (point.y > maxval) {
                    maxval = point.y;
                }
            }

            point_width = app.utils.floatFormat(100.0 / points.length, 2) + '%';

            // TODO: we should only remove nodes that are no longer valid
            for (i=0; (point = points[i]); i++) {
                pct = app.utils.floatFormat(point.y / maxval * 99, 2) + '%';
                child = existing[i];
                if (child === undefined) {
                    $('<span style="width:' + point_width + ';"><span style="height:' + pct + '" title="' + (point.label || point.y) + '">' + point.y + '</span></span>').appendTo($el);
                } else {
                    $(child).find('span').css('height', pct).text(point.y).attr('title', (point.label || point.y));
                }
            }
        }

    };
}(app, Backbone, jQuery));