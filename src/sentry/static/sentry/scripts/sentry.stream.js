/*jshint browser:true */

if (Sentry === undefined) {
    var Sentry = {};
}
(function(app, jQuery){
    "use strict";

    var $ = jQuery;

    Sentry.stream = {};
    Sentry.stream.clear = function() {
        if (window.confirm("Are you sure you want to mark all your stream as resolved?")) {
            $.ajax({
                url: app.config.urlPrefix + '/api/' + app.config.teamId + '/' + app.config.projectId + '/clear/',
                type: 'post',
                dataType: 'json',
                success: function(groups){
                    window.location.reload();
                }
            });
        }
    };
    Sentry.stream.resolve = function(gid, remove){
        if (typeof(remove) == 'undefined') {
            remove = true;
        }
        $.ajax({
            url: app.config.urlPrefix + '/api/' + app.config.teamId + '/' + app.config.projectId + '/resolve/',
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
            url: app.config.urlPrefix + '/api/' + app.config.teamId + '/' + app.config.projectId + '/bookmark/',
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
}(app, jQuery));
