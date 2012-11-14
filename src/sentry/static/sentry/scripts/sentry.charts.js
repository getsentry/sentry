if (Sentry === undefined) {
    var Sentry = {};
}
(function(){
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
                $sparkline.height($sparkline.parent().height());

                $.plot($sparkline, [
                    {
                        data: data,
                        color: '#3079d0',
                        shadowSize: 0,
                        lines: {
                            lineWidth: 1,
                            show: true,
                            fill: true
                        }
                    }
                ], {
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
                        backgroundColor: '#f9f9f9',
                        borderColor: '#eeeeee',
                        borderWidth: 1,
                        tickColor: '#eeeeee'
                    },
                    hoverable: false,
                    legend: {
                        noColumns: 5
                    },
                    lines: { show: false }

                });
            }
        });
    };
}());