/*global jQuery:true*/
function varToggle(link, id) {
    "use strict";

    jQuery(id).toggle();
    var s = link.getElementsByTagName('span')[0];
    var uarr = String.fromCharCode(0x25b6);
    var darr = String.fromCharCode(0x25bc);
    s.innerHTML = s.innerHTML == uarr ? darr : uarr;
    return false;
}

if (Sentry === undefined) {
    var Sentry = {};
}

(function(jQuery){
    "use strict";

    var $ = jQuery;

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

    Sentry.prettyDate = function(date_str) {
        // we need to zero out at CST
        var time = Date.parse(date_str);
        var now = new Date();
        var now_utc = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds()
        );

        var seconds = (now_utc - time) / 1000;
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

    Sentry.toggle = function(el){
      var $el = $(el);
      $el.toggle();
    };

    Sentry.getQueryParams = function() {
        var vars = {}, hash;
        var href = window.location.href;
        if (href.indexOf('?') === -1) {
          return vars;
        }
        var hashes = href.slice(href.indexOf('?') + 1, (href.indexOf('#') !== -1 ? href.indexOf('#') : href.length)).split('&');
        $.each(hashes, function(_, chunk){
            hash = chunk.split('=');
            if (!hash[0] && !hash[1]) {
              return;
            }
            vars[hash[0]] = hash[1] ? decodeURIComponent(hash[1]).replace(/\+/, ' ') : '';
        });
        return vars;
    };

    $(document).ready(function(){
        // replace text inputs with remote select2 widgets
        $('.filter').each(function(_, el){
            var $filter = $(el);
            var $input = $filter.find('input[type=text]');
            if ($input.length > 0) {
                $input.select2({
                    initSelection: function (el, callback) {
                        var $el = $(el);
                        callback({id: $el.val(), text: $el.val()});
                    },
                    allowClear: true,
                    minimumInputLength: 3,
                    ajax: {
                        url: Sentry.options.urlPrefix + '/api/' + Sentry.options.projectId + '/tags/search/',
                        dataType: 'json',
                        data: function (term, page) {
                            return {
                                query: term,
                                quietMillis: 300,
                                name: $input.attr('name'),
                                limit: 10
                            };
                        },
                        results: function (data, page) {
                            var results = [];
                            $(data.results).each(function(_, val){
                                results.push({
                                    id: val,
                                    text: val
                                });
                            });
                            return {results: results};
                        }
                    }
                });
            } else {
                $input = $filter.find('select').select2({
                    allowClear: true
                });
            }
            if ($input.length) {
                $input.on('change', function(e){
                    var query = Sentry.getQueryParams();
                    query[e.target.name] = e.val;
                    window.location.href = '?' + $.param(query);
                });
            }
        });

        // Update date strings periodically
        setInterval(Sentry.prettyDates, 5000);
        Sentry.prettyDates();
    });

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

}(jQuery));
