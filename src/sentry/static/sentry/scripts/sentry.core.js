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

(function(app, jQuery){
    "use strict";

    var $ = jQuery;

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
                        url: app.config.urlPrefix + '/api/' + app.config.teamId + '/' + app.config.projectId + '/tags/search/',
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
            if ($input.length > 0) {
                $input.on('change', function(e){
                    var query = app.utils.getQueryParams();
                    query[e.target.name] = e.val;
                    window.location.href = '?' + $.param(query);
                });
            }
        });
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
                "<link href=\"" + app.config.popupCss + "\" rel=\"stylesheet\" type=\"text/css\"/>" +
            "</head><body>" +
                "<div id=\"popup\">" + content + "</div></body>" +
            "</html>");
    });

}(app, jQuery));
