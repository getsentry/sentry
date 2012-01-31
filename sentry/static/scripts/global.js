
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
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1, window.location.href.indexOf('#') || -1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars[hash[0]] = hash[1];
    }
    return vars;
}

/**
 * Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
 * © 2011 Colin Snover <http://zetafleet.com>
 * Released under MIT license.
 */
(function (Date, undefined) {
    var origParse = Date.parse, numericKeys = [ 1, 4, 5, 6, 7, 10, 11 ];
    Date.parse = function (date) {
        var timestamp, struct, minutesOffset = 0;

        // ES5 §15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
        // before falling back to any implementation-specific date parsing, so that's what we do, even if native
        // implementations could be faster
        //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 ±    10 tzHH    11 tzmm
        if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
            // avoid NaN timestamps caused by "undefined" values being passed to Date.UTC
            for (var i = 0, k; (k = numericKeys[i]); ++i) {
                struct[k] = +struct[k] || 0;
            }

            // allow undefined days and months
            struct[2] = (+struct[2] || 1) - 1;
            struct[3] = +struct[3] || 1;

            if (struct[8] !== 'Z' && struct[9] !== undefined) {
                minutesOffset = struct[10] * 60 + struct[11];

                if (struct[9] === '+') {
                    minutesOffset = 0 - minutesOffset;
                }
            }

            timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
        }
        else {
            timestamp = origParse ? origParse(date) : NaN;
        }

        return timestamp;
    };
}(Date));

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
        var $el = $('#sentry-realtime');
        $el.removeClass('realtime-play');
        $el.addClass('realtime-pause');
        $el.text('Pause Feed');
        Sentry.realtime.status = true;
    };

    Sentry.realtime.disable = function(){
        var $el = $('#sentry-realtime');
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
        $('#sentry-realtime').click(function(){
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

    Sentry.prettyDate = function(date_str) {
        // we need to zero out at CST
        var time = Date.parse(date_str);
        var seconds = (new Date() - time) / 1000;
        // var offset = (new Date().getTimezoneOffset() - 300) * 60;
        // seconds = seconds + offset;
        var token = 'ago';
        var time_formats = [
          [60, 'just now', 'just now'], // 60
          [120, '1 minute ago', '1 minute from now'], // 60*2
          [3600, 'minutes', 60], // 60*60, 60
          [7200, '1 hour ago', '1 hour from now'], // 60*60*2
          [86400, 'hours', 3600], // 60*60*24, 60*60
          [172800, 'yesterday', 'tomorrow'], // 60*60*24*2
          [604800, 'days', 86400], // 60*60*24*7, 60*60*24
          [1209600, 'last week', 'next week'], // 60*60*24*7*4*2
          [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
          [4838400, 'last month', 'next month'], // 60*60*24*7*4*2
          [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
          [58060800, 'last year', 'next year'], // 60*60*24*7*4*12*2
          [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
          [5806080000, 'last century', 'next century'], // 60*60*24*7*4*12*100*2
          [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
        ];
        var list_choice = 1;

        if (seconds < 0)
        {
            seconds = Math.abs(seconds);
            token = 'from now';
            list_choice = 2;
        }

        for (var i=0, format; (format = time_formats[i]); i++) {
            if (seconds < format[0])
            {
                if (typeof format[2] == 'string')
                    return format[list_choice];
                else
                    return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
            }
        }
        return time;
    };

    Sentry.prettyDates = function() {
        $('.pretty-date').each(function(_, el){
            var $el = $(el);
            var title = $el.attr('title');
            if (title) {
                var date = Sentry.prettyDate(title);
                if (date) {
                    $el.text(date);
                }
            }
        });
    };

    $(function(){
        setInterval(Sentry.prettyDates, 5000);
        Sentry.prettyDates();
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