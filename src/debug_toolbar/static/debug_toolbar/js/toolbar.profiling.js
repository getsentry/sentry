(function ($) {
    function getSubcalls(row) {
        var id = row.attr('id');
        return $('.djDebugProfileRow[id^="'+id+'_"]');
    }
    function getDirectSubcalls(row) {
        var subcalls = getSubcalls(row);
        var depth = parseInt(row.attr('depth'), 10) + 1;
        return subcalls.filter('[depth='+depth+']');
    }
    $('.djDebugProfileRow .djDebugProfileToggle').on('click', function(){
        var row = $(this).closest('.djDebugProfileRow');
        var subcalls = getSubcalls(row);
        if (subcalls.css('display') == 'none') {
            getDirectSubcalls(row).show();
        } else {
            subcalls.hide();
        }
    });
    djdt.applyStyle('padding-left');
})(djdt.jQuery);
