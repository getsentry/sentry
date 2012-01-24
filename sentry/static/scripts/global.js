
function varToggle(link, id) {
    $('#v' + id).toggle();
    var s = link.getElementsByTagName('span')[0];
    var uarr = String.fromCharCode(0x25b6);
    var darr = String.fromCharCode(0x25bc);
    s.innerHTML = s.innerHTML == uarr ? darr : uarr;
    return false;
}

function getQueryParams()
{
    var vars = {}, hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars[hash[0]] = hash[1];
    }
    return vars;
}

if (Sentry === undefined) {
    var Sentry = {};
}
(function(){
    var self = Sentry;

    Sentry.options = {
        urlPrefix: '',
        mediaUrl: '/media/',
        defaultImage: '/media/images/sentry.png'
    };

    Sentry.config = function(data){
        $.each(data, function(k, v){
            Sentry.options[k] = v;
        });
    };

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
                for (var i=groups.length-1, el, row; (el=groups[i]); i--) {
                    var id = el[0];
                    var data = el[1];
                    $('#group_' + id).remove();
                    if (!remove) {
                        $('#event_list').prepend(data.html);
                        $('#group_' + id).addClass('fresh');
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

    Sentry.realtime = {};
    Sentry.realtime.options = {
        viewId: null,
        projectId: null
    };

    Sentry.realtime.config = function(data){
        $.each(data, function(k, v){
            Sentry.realtime.options[k] = v;
        });
    };

    Sentry.realtime.status = false;

    Sentry.realtime.toggle = function(){
        if (Sentry.realtime.status) {
            Sentry.realtime.enable();
        } else {
            Sentry.realtime.disable();
        }
    };

    Sentry.realtime.enable = function(){
        var $el = $('#sentry_realtime');
        $el.removeClass('realtime-play');
        $el.addClass('realtime-pause');
        $el.text('Pause Feed');
        Sentry.realtime.status = true;
    };

    Sentry.realtime.disable = function(){
        var $el = $('#sentry_realtime');
        $el.addClass('realtime-play');
        $el.removeClass('realtime-pause');
        $el.text('Go Live');
        Sentry.realtime.status = false;
    };

    Sentry.realtime.refresh = function(){
        if (!Sentry.realtime.status) {
            return;
        }
        data = getQueryParams();
        data.view_id = Sentry.realtime.options.viewId || undefined;
        $.ajax({
            url: Sentry.options.urlPrefix + '/api/' + Sentry.realtime.options.projectId + '/poll/',
            type: 'get',
            dataType: 'json',
            data: data,
            success: function(groups){
                if (groups.length) {
                    $('#no_messages').remove();
                }
                $(groups.reverse()).each(function(i, el){
                    var id = el[0];
                    var data = el[1];
                    var url = Sentry.options.urlPrefix + '/api/notification/?' + $.param({
                        count: data.count,
                        title: data.title,
                        message: data.message,
                        level: data.level,
                        logger: data.logger
                    });
                    if ((row = $('#group_' + id))) {
                        if (row.attr('data-sentry-count') == data.count) {
                            return;
                        }
                        row.remove();
                    } else {
                        //Sentry.notifications.show({'type': 'html', 'url': url});
                    }
                    $('#event_list').prepend(data.html);
                    $('#group_' + id).addClass('fresh');
                });

                $('#event_list .fresh').css('background-color', '#ccc').animate({backgroundColor: '#fff'}, 1200, function() {
                    $(this).removeClass('fresh');
                });
                // make sure we limit the number shown
                var count = 0;
                $('#event_list li').each(function(){
                    count++;
                    if (count > 50) {
                        $(this).remove();
                    }
                });
                setTimeout(Sentry.realtime.refresh, 3000);
            }
        });
    };

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

    Sentry.notifications = {};
    Sentry.notifications.status = false;

    Sentry.notifications.enable = function(){
        // if (window.webkitNotifications.checkPermission()) {
        //     Sentry.notifications.status = true;
        //     $('#sentry_notify').text('Disable Notifications');
        // } else {
        window.webkitNotifications.requestPermission(function(){
            Sentry.notifications.status = true;
            Sentry.notifications.show({'type': 'simple', 'title': 'Sentry', 'body': 'Notifications have been enabled.'});
            $('#sentry_notify').text('Disable Notifications');
        });
        // }
    };

    Sentry.notifications.disable = function(){
        Sentry.notifications.status = false;
        $('#sentry_notify').text('Enable Notifications');
    };

    Sentry.notifications.show = function(options){
        if (!Sentry.notifications.status) return;

        var note;

        if (options.type == 'html') {
            note = window.webkitNotifications.createHTMLNotification(options.url);
        } else {
            note = window.webkitNotifications.createNotification(options.image || Sentry.options.defaultImage, options.title, options.body);
        }
        note.ondisplay = function() {
            setTimeout(function(){ note.cancel(); }, 10000);
        };
        note.show();
    };

    $(document).ready(function(){
        $('#sentry_realtime').click(function(){
            if (Sentry.realtime.status) {
                Sentry.realtime.disable();
            } else {
                Sentry.realtime.enable();
            }
        });

        setTimeout(Sentry.realtime.refresh, 3000);

        if (window.webkitNotifications){
            Sentry.notifications.status = (window.webkitNotifications.checkPermission() > 0);
            $('<li><a id="sentry_notify" href="javascript:void()">' + (Sentry.notifications.status ? 'Disable Notifications' : 'Enable Notifications') + '</a></li>').click(function(){
                if (Sentry.notifications.status) {
                    Sentry.notifications.disable();
                } else {
                    Sentry.notifications.enable();
                }
            }).prependTo('#account');
        }

        $('#sidebar .filter-list').each(function(_, el){
            var $el = $(el);
            if ($el.find('li').length > 6) {
                // rebuild this widget as a dropdown select
                var select = $('<select></select>');
                var parent = $('<div class="filter-select sidebar-module">').appendTo($el.parent());

                $el.find('li a').each(function(_, a){
                    a = $(a);
                    var opt = $('<option value="' + a.attr('href') + '">' + a.text() + '</option>').appendTo(select);
                    if (a.parent().hasClass('active')) {
                        opt.attr('selected', 'selected');
                    }
                });
                $el.remove();
                select.appendTo(parent).change(function(){
                    window.location.href = $(this).val();
                });
            }
        });
    });
}());

$(document).ajaxSend(function(event, xhr, settings) {
    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    function sameOrigin(url) {
        // url could be relative or scheme relative or absolute
        var host = document.location.host; // host + port
        var protocol = document.location.protocol;
        var sr_origin = '//' + host;
        var origin = protocol + sr_origin;
        // Allow absolute or scheme relative URLs to same origin
        return (url == origin || url.slice(0, origin.length + 1) == origin + '/') ||
            (url == sr_origin || url.slice(0, sr_origin.length + 1) == sr_origin + '/') ||
            // or any other URL that isn't scheme relative or absolute i.e relative.
            !(/^(\/\/|http:|https:).*/.test(url));
    }
    function safeMethod(method) {
        return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
    }

    if (!safeMethod(settings.type) && sameOrigin(settings.url)) {
        xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
    }
});

$('.popup').live('click', function(){
    var $this = $(this);
    var $window = $(window);
    var $container = $($this.attr('data-container'));
    var title = $this.attr('data-title') || 'Untitled';
    var content = $container.html();
    var height = Math.min($window.height() - 100, $container.height() + 40);
    var width = Math.min($window.width() - 100, $container.width() + 40);
    var w = window.open("about:blank", "dsqApiExpand", "toolbar=0,status=0,location=0,menubar=0,height=" + height + ",width=" + width);
    w.document.write("<!DOCTYPE html><html>" +
        "<head>" +
            "<title>" + title + "</title>" +
            "<link href=\"" + Sentry.options.popupCss + "\" rel=\"stylesheet\" type=\"text/css\"/>" +
        "</head><body>" +
            "<div id=\"popup\">" + content + "</div></body>" +
        "</html>");
});