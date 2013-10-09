/*global Sentry:true*/

(function(app, Backbone, jQuery, moment){
    "use strict";

    var $ = jQuery;

    app.charts = {

        render: function(el, options) {
            var $el = $('#chart');
            var url = $el.attr('data-api-url');
            var title = $(el).attr('data-title');
            var $spark = $el.find('.sparkline');

            $spark.height($el.height());

            $.ajax({
                url: $el.attr('data-api-url'),
                type: 'get',
                dataType: 'json',
                data: {
                    days: $el.attr('data-days') || 7,
                    gid: $el.attr('data-group') || undefined
                },
                success: function(resp) {
                    var data = [], maxval = 10;
                    $spark.empty();
                    $.each(resp, function(_, val){
                        var date = new Date(val[0]);
                        data.push({
                            y: val[1],
                            label: moment(date).fromNow()
                        });
                        if (val[1] > maxval) {
                            maxval = val[1];
                        }
                    });
                    app.charts.createSparkline($spark, data, options);
                }
            });
        },

        createSparkline: function(el, points, options){
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

    };
}(app, Backbone, jQuery, moment));
