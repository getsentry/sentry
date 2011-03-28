function getElementsByClassName(oElm, strTagName, strClassName){
    // Written by Jonathan Snook, http://www.snook.ca/jon; Add-ons by Robert Nyman, http://www.robertnyman.com
    var arrElements = (strTagName == "*" && document.all)? document.all :
    oElm.getElementsByTagName(strTagName);
    var arrReturnElements = new Array();
    strClassName = strClassName.replace(/\-/g, "\\-");
    var oRegExp = new RegExp("(^|\\s)" + strClassName + "(\\s|$)");
    var oElement;
    for(var i=0; i<arrElements.length; i++){
        oElement = arrElements[i];
        if(oRegExp.test(oElement.className)){
            arrReturnElements.push(oElement);
        }
    }
    return (arrReturnElements);
}
function hideAll(elems) {
  for (var e = 0; e < elems.length; e++) {
    elems[e].style.display = 'none';
  }
}
$(window).load(function() {
    $('.frame table.vars').hide();
    $('ol.pre-context').hide();
    $('ol.post-context').hide();
    $('div.pastebin').hide();
});
function toggle() {
  for (var i = 0; i < arguments.length; i++) {
    var e = document.getElementById(arguments[i]);
    if (e) {
      e.style.display = e.style.display == 'none' ? 'block' : 'none';
    }
  }
  return false;
}
function varToggle(link, id) {
  toggle('v' + id);
  var s = link.getElementsByTagName('span')[0];
  var uarr = String.fromCharCode(0x25b6);
  var darr = String.fromCharCode(0x25bc);
  s.innerHTML = s.innerHTML == uarr ? darr : uarr;
  return false;
}
function switchPastebinFriendly(link) {
  s1 = "Switch to copy-and-paste view";
  s2 = "Switch back to interactive view";
  link.innerHTML = link.innerHTML == s1 ? s2 : s1;
  toggle('browserTraceback', 'pastebinTraceback');
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

$.fn.setAllToMaxHeight = function(){
    return this.height( Math.max.apply(this, $.map( this , function(e){ return $(e).height(); }) ) );
};

var Sentry = {};
(function(){
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
                        $('#message_list').prepend(data.html);
                        $('#group_' + id).addClass('fresh');
                    }
                }
            }
        });
    };
    
    Sentry.realtime = {};
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
                    if ((row = $('#group_' + id))) {
                        row.remove();
                        $('#message_list').prepend(data.html);
                        if (row.attr('data-sentry-count') != data.count) {
                            $('#group_' + id).addClass('fresh');
                            var url = Sentry.options.apiUrl + '?' + $.param({
                                op: 'notification',
                                count: data.count,
                                title: data.title,
                                message: data.message,
                                level: data.level,
                                logger: data.logger
                            });
                        }
                    } else {
                        $('#message_list').prepend(data.html);
                        $('#group_' + id).addClass('fresh');
                        Sentry.notifications.show({'type': 'html', 'url': url});
                    }
                }
                $('#message_list .fresh').css('background-color', '#ccc').animate({backgroundColor: '#fff'}, 1200, function() { 
                    $(this).removeClass('fresh');
                });
                // make sure we limit the number shown
                var count = 0;
                $('#message_list li').each(function(){
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
            var el = $(el);
            if (el.find('li').length > 6) {
                // rebuild this widget as a dropdown select
                var select = $('<select></select>');
                var parent = $('<div class="filter-select sidebar-module">').appendTo(el.parent());

                el.find('li a').each(function(_, a){
                    a = $(a);
                    var opt = $('<option value="' + a.attr('href') + '">' + a.text() + '</option>').appendTo(select);
                    if (a.parent().hasClass('active')) {
                        opt.attr('selected', 'selected');
                    }
                });
                el.remove();
                select.appendTo(parent).change(function(){
                    window.location.href = $(this).val();
                });
            }
        });
    });

    // Ensure that the CSRF token is sent with AJAX POSTs sent by jQuery
    // Taken from the documentation: http://docs.djangoproject.com/en/dev/ref/contrib/csrf/
    $('html').ajaxSend(function(event, xhr, settings) {
        function getCookie(name) {
            var cookieValue = null;
            if (document.cookie && document.cookie != '') {
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
        if (!(/^http:.*/.test(settings.url) || (/^https:.*/.test(settings.url)))) {
            // Only send the token to relative URLs i.e. locally.
            xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
        }
    });
}());
