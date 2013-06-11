if (Sentry === undefined) {
    var Sentry = {};
}
(function(jQuery){
    "use strict";

    var $ = jQuery;

    var average = function(a) {
        var r = {mean: 0, variance: 0, deviation: 0}, t = a.length;
        for (var m, s = 0, l = t; l--; s += a[l]);
        for (m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(a[l] - m, 2));
        r.deviation = Math.sqrt(r.variance = s / t);
        return r;
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
                        color: '#56AFE8',
                        shadowSize: 0,
                        lines: {
                            lineWidth: 2,
                            show: true,
                            fill: true
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
                       mode: "time"
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
                    grid: {
                        show: true,
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
}(jQuery));
