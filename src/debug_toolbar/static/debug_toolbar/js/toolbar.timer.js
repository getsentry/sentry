(function ($) {
    // Browser timing remains hidden unless we can successfully access the performance object
    var perf = window.performance || window.msPerformance ||
               window.webkitPerformance || window.mozPerformance;
    if (!perf)
        return;

    var rowCount = 0,
        timingOffset = perf.timing.navigationStart,
        timingEnd = perf.timing.loadEventEnd,
        totalTime = timingEnd - timingOffset;
    function getLeft(stat) {
        return ((perf.timing[stat] - timingOffset) / (totalTime)) * 100.0;
    }
    function getCSSWidth(stat, endStat) {
        var width = ((perf.timing[endStat] - perf.timing[stat]) / (totalTime)) * 100.0;
        // Calculate relative percent (same as sql panel logic)
        width = 100.0 * width / (100.0 - getLeft(stat));
        return (width < 1) ? "2px" : width + "%";
    }
    function addRow(stat, endStat) {
        rowCount++;
        var $row = $('<tr class="' + ((rowCount % 2) ? 'djDebugOdd' : 'djDebugEven') + '"></tr>');
        if (endStat) {
            // Render a start through end bar
            $row.html('<td>' + stat.replace('Start', '') + '</td>' +
                      '<td class="timeline"><div class="djDebugTimeline"><div class="djDebugLineChart"><strong>&nbsp;</strong></div></div></td>' +
                      '<td>' + (perf.timing[stat] - timingOffset) + ' (+' + (perf.timing[endStat] - perf.timing[stat]) + ')</td>');
            $row.find('strong').css({width: getCSSWidth(stat, endStat)});
        } else {
            // Render a point in time
             $row.html('<td>' + stat + '</td>' +
                       '<td class="timeline"><div class="djDebugTimeline"><div class="djDebugLineChart"><strong>&nbsp;</strong></div></div></td>' +
                       '<td>' + (perf.timing[stat] - timingOffset) + '</td>');
             $row.find('strong').css({width: 2});
        }
        $row.find('djDebugLineChart').css({left: getLeft(stat) + '%'});
        $('#djDebugBrowserTimingTableBody').append($row);
    }

    // This is a reasonably complete and ordered set of timing periods (2 params) and events (1 param)
    addRow('domainLookupStart', 'domainLookupEnd');
    addRow('connectStart', 'connectEnd');
    addRow('requestStart', 'responseEnd'); // There is no requestEnd
    addRow('responseStart', 'responseEnd');
    addRow('domLoading', 'domComplete'); // Spans the events below
    addRow('domInteractive');
    addRow('domContentLoadedEventStart', 'domContentLoadedEventEnd');
    addRow('loadEventStart', 'loadEventEnd');
    $('#djDebugBrowserTiming').css("display", "block");
})(djdt.jQuery);
