/*global jQuery:true*/

if (Sentry === undefined) {
    var Sentry = {};
}

(function(app, jQuery){
    "use strict";

    var $ = jQuery;

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

    $(function(){
        $('.popup').on('click', function(){
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
    });

}(app, jQuery));
