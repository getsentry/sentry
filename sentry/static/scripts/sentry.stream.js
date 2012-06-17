if (Sentry === undefined) {
    var Sentry = {};
}
(function(){
    Sentry.stream = {};
    Sentry.stream.clear = function(project_id) {
        if (confirm("Are you sure you want to mark all your stream as resolved?")) {
            $.ajax({
                url: Sentry.options.urlPrefix + '/api/' + project_id + '/clear/',
                type: 'post',
                dataType: 'json',
                success: function(groups){
                    window.location.reload();
                }
            });
        }
    };
    Sentry.stream.resolve = function(project_id, gid, remove){
        if (typeof(remove) == 'undefined') {
            remove = true;
        }
        $.ajax({
            url: Sentry.options.urlPrefix + '/api/' + project_id + '/resolve/',
            type: 'post',
            dataType: 'json',
            data: {
                gid: gid
            },
            success: function(groups){
                for (var i=groups.length-1, data, row; (data=groups[i]); i--) {
                    $('.event[data-group="' + data.id + '"]').remove();
                    if (!remove) {
                        $('#event_list').prepend(data.html);
                        $('.event[data-group="' + data.id + '"]').addClass('fresh');
                    }
                }
            }
        });
    };
    Sentry.stream.bookmark = function(project_id, gid, el){
        $.ajax({
            url: Sentry.options.urlPrefix + '/api/' + project_id + '/bookmark/',
            type: 'post',
            dataType: 'json',
            data: {
                gid: gid
            },
            success: function(data){
                if (!el) {
                    return;
                }
                var $el = $(el);
                if (data.bookmarked) {
                    $el.addClass('checked');
                } else {
                    $el.removeClass('checked');
                }
            }
        });
    };
}());