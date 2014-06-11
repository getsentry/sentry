define([
    'jquery',
    'moment',

    'app/utils',

    'jquery.flot',
    'jquery.flot.dashes',
    'jquery.flot.resize',
    'jquery.flot.time',
    'jquery.flot.tooltip'
], function($, moment, utils){
    'use strict';

    var average = function(a) {
        var r = {mean: 0, variance: 0, deviation: 0}, t = a.length;
        for (var m, s = 0, l = t; l--; s += a[l]);
        for (m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(a[l] - m, 2));
        r.deviation = Math.sqrt(r.variance = s / t);
        return r;
    };

    var percentile = function(a, nth) {
        a = a.sort();
        a.slice(0, a.length - Math.floor(nth / a.length));
        return average(a);
    };

    var timeUnitSize = {
        "second": 1000,
        "minute": 60 * 1000,
        "hour": 60 * 60 * 1000,
        "day": 24 * 60 * 60 * 1000,
        "month": 30 * 24 * 60 * 60 * 1000,
        "quarter": 3 * 30 * 24 * 60 * 60 * 1000,
        "year": 365.2425 * 24 * 60 * 60 * 1000
    };

    var tickFormatter = function (value, axis) {
        var d = moment(value);

        var t = axis.tickSize[0] * timeUnitSize[axis.tickSize[1]];
        var span = axis.max - axis.min;
        var fmt;

        if (t < timeUnitSize.minute) {
            fmt = 'LT';
        } else if (t < timeUnitSize.day) {
            fmt = 'LT';
            if (span < 2 * timeUnitSize.day) {
                fmt = 'LT';
            } else {
                fmt = 'MMM D LT';
            }
        } else if (t < timeUnitSize.month) {
            fmt = 'MMM D';
        } else if (t < timeUnitSize.year) {
            if (span < timeUnitSize.year) {
                fmt = 'MMM';
            } else {
                fmt = 'MMM YY';
            }
        } else {
            fmt = 'YY';
        }

        return d.format(fmt);
    };

    var charts = {
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
                    since: new Date().getTime() / 1000 - 3600 * 24,
                    resolution: '1h'
                },
                success: function(resp) {
                    var data = [], maxval = 10;
                    $spark.empty();
                    $.each(resp, function(_, val){
                        var date = new Date(val[0] * 1000);
                        data.push({
                            y: val[1],
                            label: moment(date).fromNow()
                        });
                        if (val[1] > maxval) {
                            maxval = val[1];
                        }
                    });
                    charts.createSparkline($spark, data, options);
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

            point_width = utils.floatFormat(100.0 / points.length, 2) + '%';

            // TODO: we should only remove nodes that are no longer valid
            for (i=0; i<points.length; i++) {
                point = points[i];
                pct = utils.floatFormat(point.y / maxval * 99, 2) + '%';
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
        },
        createBasic: function(el){
            var $sparkline = $(el);

            if ($sparkline.length < 1) {
                return; // Supress an empty chart
            }

            $.ajax({
                url: $sparkline.attr('data-api-url'),
                type: 'get',
                dataType: 'json',
                data: {
                    since: new Date().getTime() / 1000 - 3600 * 24 * 7,
                    resolution: '1h'
                },
                success: function(data){
                    var inputs = [], avg, i, data_avg = [], p_95th;
                    for (i = 0; i < data.length; i++) {
                        inputs.push(data[i][1]);

                        // set timestamp to be in millis
                        data[i][0] = data[i][0] * 1000;
                    }
                    p_95th = percentile(inputs);

                    for (i = 0; i < data.length; i++) {
                        data_avg.push([data[i][0], p_95th.mean]);
                    }

                    var points = [
                        {
                            data: data,
                            color: 'rgba(86, 175, 232, 1)',
                            shadowSize: 0,
                            lines: {
                                lineWidth: 2,
                                show: true,
                                fill: false
                            }
                        },
                        {
                            data: data_avg,
                            color: 'rgba(244, 63, 32, .4)',
                            // color: '#000000',
                            shadowSize: 0,
                            dashes: {
                                lineWidth: 2,
                                show: true,
                                fill: false
                            }
                        }
                    ];
                    var options = {
                        xaxis: {
                           mode: "time",
                           tickFormatter: tickFormatter
                        },
                        yaxis: {
                           min: 0,
                           tickFormatter: function(value) {
                                if (value > 999999) {
                                    return (value / 1000000) + 'mm';
                                }
                                if (value > 999) {
                                    return (value / 1000) + 'k';
                                }
                                return value;
                           }
                        },
                        tooltip: true,
                        tooltipOpts: {
                            content: function(label, xval, yval, flotItem) {
                                return yval + ' events<br>' + moment(xval).format('llll');
                            },
                            defaultTheme: false
                        },
                        grid: {
                            show: true,
                            hoverable: true,
                            backgroundColor: '#ffffff',
                            borderColor: '#DEE3E9',
                            borderWidth: 2,
                            tickColor: '#DEE3E9'
                        },
                        hoverable: false,
                        legend: {
                            noColumns: 5
                        },
                        lines: { show: false }
                    };

                    $.plot($sparkline, points, options);

                    $(window).resize(function(){
                        $.plot($sparkline, points, options);
                    });

                }

            });
        }
    };

    return charts;
});
