if (Sentry === undefined) {
    var Sentry = {};
}
(function(jQuery, moment){
    "use strict";

    var $ = jQuery;

    var average = function(a) {
        var r = {mean: 0, variance: 0, deviation: 0}, t = a.length;
        for (var m, s = 0, l = t; l--; s += a[l]);
        for (m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(a[l] - m, 2));
        r.deviation = Math.sqrt(r.variance = s / t);
        return r;
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

    Sentry.charts = {};
    Sentry.charts.render = function(el){
        var $sparkline = $(el);

        if ($sparkline.length < 1) {
            return; // Supress an empty chart
        }

        $.ajax({
            url: $sparkline.attr('data-api-url'),
            type: 'get',
            dataType: 'json',
            data: {
                days: 7,
                gid: $sparkline.attr('data-group') || undefined
            },
            success: function(data){
                var inputs = [], avg, i, data_avg = [];
                for (i = 0; i < data.length; i++) {
                    inputs.push(data[i][1]);
                }
                avg = average(inputs);

                for (i = 0; i < data.length; i++) {
                    data_avg.push([data[i][0], avg.deviation]);
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
    };
}(jQuery, moment));
