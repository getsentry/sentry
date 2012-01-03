
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
        mediaUrl: '/media/',
        apiUrl: '/api/',
        defaultImage: '/media/images/sentry.png'
    };

    Sentry.config = function(data){
        $.each(data, function(k, v){
            Sentry.options[k] = v;
        });
    };

    Sentry.stream = {};
    Sentry.stream.clear = function() {
        if (confirm("Are you sure you want to mark all your stream as resolved?")) {
            $.ajax({
                url: Sentry.options.apiUrl,
                type: 'post',
                dataType: 'json',
                data: {
                    op: 'clear'
                },
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
            url: Sentry.options.apiUrl,
            type: 'post',
            dataType: 'json',
            data: {
                op: 'resolve',
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

    Sentry.realtime.enable = function(){
        $('#sentry_realtime').removeClass('realtime-play');
        $('#sentry_realtime').addClass('realtime-pause');
        $('#sentry_realtime').text('Pause Feed');
        Sentry.realtime.status = true;
    };

    Sentry.realtime.disable = function(){
        $('#sentry_realtime').addClass('realtime-play');
        $('#sentry_realtime').removeClass('realtime-pause');
        $('#sentry_realtime').text('Go Live');
        Sentry.realtime.status = false;
    };

    Sentry.realtime.refresh = function(){
        data = getQueryParams();
        data.view_id = Sentry.realtime.options.viewId;
        data.op = 'poll';
        if (!Sentry.realtime.status) {
            return;
        }
        $.ajax({
            url: Sentry.options.apiUrl,
            type: 'get',
            dataType: 'json',
            data: data,
            success: function(groups){
                if (groups.length) {
                    $('#no_messages').remove();
                }
                for (var i=groups.length-1, el, row; (el=groups[i]); i--) {
                    var id = el[0];
                    var data = el[1];
                    var url = Sentry.options.apiUrl + '?' + $.param({
                        op: 'notification',
                        count: data.count,
                        title: data.title,
                        message: data.message,
                        level: data.level,
                        logger: data.logger
                    });
                    if ((row = $('#group_' + id))) {
                        row.remove();
                        $('#event_list').prepend(data.html);
                        if (row.attr('data-sentry-count') != data.count) {
                            $('#group_' + id).addClass('fresh');
                        }
                    } else {
                        $('#event_list').prepend(data.html);
                        $('#group_' + id).addClass('fresh');
                        Sentry.notifications.show({'type': 'html', 'url': url});
                    }
                }
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