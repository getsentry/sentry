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
                days: 1,
                gid: $sparkline.attr('data-group') || undefined
            },
            success: function(data){
                var start = new Date().getTime() - data.length * 3600000;
                var chunks = [];
                var max = 25;
                var pairs = [];
                var chunk = {
                    data: pairs,
                    shadowSize: 0,
                    lines: {
                        lineWidth: 1,
                        show: true,
                        fill: true
                    }
                };
                $.each(data, function(num, val){
                    pairs.push([start + (3600 * 1000) * num, val]);
                    if (val > max) {
                        max = val;
                    }
                });
                chunks.push(chunk);
                $sparkline.height($sparkline.parent().height());
                $.plot($sparkline, [
                    {
                        data: pairs,
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
                       max: max
                    },
                    grid: {
                        show: true,
                        backgroundColor: '#f9f9f9',
                        borderColor: '#eeeeee',
                        borderWidth: 1,
                        tickColor: '#eeeeee'
                    },
                    legend: {
                        noColumns: 5
                    },
                    lines: { show: false }

                });
            }
        });
    };
}());