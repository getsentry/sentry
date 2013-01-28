if (Sentry === undefined) {
    var Sentry = {};
}
(function(jQuery){
    "use strict";

    var $ = jQuery;

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