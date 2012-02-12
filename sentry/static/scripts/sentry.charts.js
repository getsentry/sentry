if (Sentry === undefined) {
    var Sentry = {};
}
(function(){
    Sentry.charts = {};
    Sentry.charts.render = function(el, project_id, group_id, grid){
        var $sparkline = $(el);

        if ($sparkline.length < 1) {
            return; // Supress an empty chart
        }

        $.ajax({
            url: Sentry.options.urlPrefix + '/api/' + project_id + '/chart/',
            type: 'get',
            dataType: 'json',
            data: {
                days: 1,
                gid: group_id || undefined
            },
            success: function(data){
                var start = new Date().getTime() - data.length * 3600000;
                var pairs = [];
                // for (var i=0; i<1000; i++) {
                //     pairs.push([start + (3600 * 1000) * i, Math.random()*1000]);
                // }
                for (var i=0; i<data.length; i++) {
                    pairs.push([start + (3600 * 1000) * i, data[i]]);
                }
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
                    grid: {
                        show: grid || false,
                        borderColor: '#dddddd',
                        borderWidth: 1,
                        backgroundColor: '#F5F5F5'
                    },
                    lines: { show: false }

                });
            }
        });
    };
}());