(function ($, publicAPI) {
    var djdt = {
        handleDragged: false,
        events: {
            ready: []
        },
        isReady: false,
        init: function() {
            $('#djDebug').show();
            var current = null;
            $('#djDebugPanelList').on('click', 'li a', function() {
                if (!this.className) {
                    return false;
                }
                current = $('#djDebug #' + this.className);
                if (current.is(':visible')) {
                    $(document).trigger('close.djDebug');
                    $(this).parent().removeClass('djdt-active');
                } else {
                    $('.djdt-panelContent').hide(); // Hide any that are already open
                    var inner = current.find('.djDebugPanelContent .djdt-scroll'),
                        store_id = $('#djDebug').data('store-id'),
                        render_panel_url = $('#djDebug').data('render-panel-url');
                    if (store_id !== '' && inner.children().length === 0) {
                        var ajax_data = {
                            data: {
                                store_id: store_id,
                                panel_id: this.className
                            },
                            type: 'GET',
                            url: render_panel_url
                        };
                        $.ajax(ajax_data).done(function(data){
                            inner.prev().remove();  // Remove AJAX loader
                            inner.html(data);
                        }).fail(function(xhr){
                            var message = '<div class="djDebugPanelTitle"><a class="djDebugClose djDebugBack" href=""></a><h3>'+xhr.status+': '+xhr.statusText+'</h3></div>';
                            $('#djDebugWindow').html(message).show();
                        });
                    }
                    current.show();
                    $('#djDebugToolbar li').removeClass('djdt-active');
                    $(this).parent().addClass('djdt-active');
                }
                return false;
            });
            $('#djDebug').on('click', 'a.djDebugClose', function() {
                $(document).trigger('close.djDebug');
                $('#djDebugToolbar li').removeClass('djdt-active');
                return false;
            });
            $('#djDebug').on('click', '.djDebugPanelButton input[type=checkbox]', function() {
                djdt.cookie.set($(this).attr('data-cookie'), $(this).prop('checked') ? 'on' : 'off', {
                    path: '/',
                    expires: 10
                });
            });

            // Used by the SQL and template panels
            $('#djDebug').on('click', '.remoteCall', function() {
                var self = $(this);
                var name = self[0].tagName.toLowerCase();
                var ajax_data = {};

                if (name == 'button') {
                    var form = self.parents('form:eq(0)');
                    ajax_data['url'] = self.attr('formaction');

                    if (form.length) {
                        ajax_data['data'] = form.serialize();
                        ajax_data['type'] = form.attr('method') || 'POST';
                    }
                }

                if (name == 'a') {
                    ajax_data['url'] = self.attr('href');
                }

                $.ajax(ajax_data).done(function(data){
                    $('#djDebugWindow').html(data).show();
                }).fail(function(xhr){
                        var message = '<div class="djDebugPanelTitle"><a class="djDebugClose djDebugBack" href=""></a><h3>'+xhr.status+': '+xhr.statusText+'</h3></div>';
                        $('#djDebugWindow').html(message).show();
                });

                $('#djDebugWindow').on('click', 'a.djDebugBack', function() {
                    $(this).parent().parent().hide();
                    return false;
                });

                return false;
            });

            // Used by the cache, profiling and SQL panels
            $('#djDebug').on('click', 'a.djToggleSwitch', function(e) {
                e.preventDefault();
                var btn = $(this);
                var id = btn.attr('data-toggle-id');
                var open_me = btn.text() == btn.attr('data-toggle-open');
                if (id === '' || !id) {
                    return;
                }
                var name = btn.attr('data-toggle-name');
                btn.parents('.djDebugPanelContent').find('#' + name + '_' + id).find('.djDebugCollapsed').toggle(open_me);
                btn.parents('.djDebugPanelContent').find('#' + name + '_' + id).find('.djDebugUncollapsed').toggle(!open_me);
                $(this).parents('.djDebugPanelContent').find('.djToggleDetails_' + id).each(function(){
                    var $this = $(this);
                    if (open_me) {
                        $this.addClass('djSelected');
                        $this.removeClass('djUnselected');
                        btn.text(btn.attr('data-toggle-close'));
                        $this.find('.djToggleSwitch').text(btn.text());
                    } else {
                        $this.removeClass('djSelected');
                        $this.addClass('djUnselected');
                        btn.text(btn.attr('data-toggle-open'));
                        $this.find('.djToggleSwitch').text(btn.text());
                    }
                });
                return;
            });

            $('#djHideToolBarButton').click(function() {
                djdt.hide_toolbar(true);
                return false;
            });
            $('#djShowToolBarButton').click(function() {
                if (!djdt.handleDragged) {
                    djdt.show_toolbar();
                }
                return false;
            });
            var handle = $('#djDebugToolbarHandle');
            $('#djShowToolBarButton').on('mousedown', function (event) {
                var startPageY = event.pageY;
                var baseY = handle.offset().top - startPageY;
                var windowHeight = $(window).height();
                $(document).on('mousemove.djDebug', function (event) {
                    // Chrome can send spurious mousemove events, so don't do anything unless the
                    // cursor really moved.  Otherwise, it will be impossible to expand the toolbar
                    // due to djdt.handleDragged being set to true.
                    if (djdt.handleDragged || event.pageY != startPageY) {
                        var top = baseY + event.clientY;
                        
                        if (top < 0) {
                            top = 0;
                        } else if (top + handle.height() > windowHeight) {
                            top = windowHeight - handle.height();
                        }
                        
                        handle.css({top: top});
                        djdt.handleDragged = true;
                    }
                });
                return false;
            });
            $(document).on('mouseup', function () {
                $(document).off('mousemove.djDebug');
                if (djdt.handleDragged) {
                    var top = handle.offset().top - window.pageYOffset;
                    djdt.cookie.set('djdttop', top, {
                        path: '/',
                        expires: 10
                    });
                    setTimeout(function () {
                        djdt.handleDragged = false;
                    }, 10);
                    return false;
                }
            });
            $(document).bind('close.djDebug', function() {
                // If a sub-panel is open, close that
                if ($('#djDebugWindow').is(':visible')) {
                    $('#djDebugWindow').hide();
                    return;
                }
                // If a panel is open, close that
                if ($('.djdt-panelContent').is(':visible')) {
                    $('.djdt-panelContent').hide();
                    $('#djDebugToolbar li').removeClass('djdt-active');
                    return;
                }
                // Otherwise, just minimize the toolbar
                if ($('#djDebugToolbar').is(':visible')) {
                    djdt.hide_toolbar(true);
                    return;
                }
            });
            if (djdt.cookie.get('djdt') == 'hide') {
                djdt.hide_toolbar(false);
            } else {
                djdt.show_toolbar(false);
            }
            $('#djDebug .djDebugHoverable').hover(function(){
                $(this).addClass('djDebugHover');
            }, function(){
                $(this).removeClass('djDebugHover');
            });
            djdt.isReady = true;
            $.each(djdt.events.ready, function(_, callback){
                callback(djdt);
            });
        },
        close: function() {
            $(document).trigger('close.djDebug');
            return false;
        },
        hide_toolbar: function(setCookie) {
            // close any sub panels
            $('#djDebugWindow').hide();
            // close all panels
            $('.djdt-panelContent').hide();
            $('#djDebugToolbar li').removeClass('djdt-active');
            // finally close toolbar
            $('#djDebugToolbar').hide('fast');
            $('#djDebugToolbarHandle').show();
            // set handle position
            var handleTop = djdt.cookie.get('djdttop');
            if (handleTop) {
                $('#djDebugToolbarHandle').css({top: handleTop + 'px'});
            }
            // Unbind keydown
            $(document).unbind('keydown.djDebug');
            if (setCookie) {
                djdt.cookie.set('djdt', 'hide', {
                    path: '/',
                    expires: 10
                });
            }
        },
        show_toolbar: function(animate) {
            // Set up keybindings
            $(document).bind('keydown.djDebug', function(e) {
                if (e.keyCode == 27) {
                    djdt.close();
                }
            });
            $('#djDebugToolbarHandle').hide();
            if (animate) {
                $('#djDebugToolbar').show('fast');
            } else {
                $('#djDebugToolbar').show();
            }
            djdt.cookie.set('djdt', 'show', {
                path: '/',
                expires: 10
            });
        },
        ready: function(callback){
            if (djdt.isReady) {
                callback(djdt);
            } else {
                djdt.events.ready.push(callback);
            }
        },
        cookie: {
            get: function(key){
                if (document.cookie.indexOf(key) === -1) return null;

                var cookieArray = document.cookie.split('; '),
                    cookies = {};

                cookieArray.forEach(function(e){
                    var parts = e.split('=');
                    cookies[ parts[0] ] = parts[1];
                });

                return cookies[ key ];
            },
            set: function(key, value, options){
                options = options || {};

                if (typeof options.expires === 'number') {
                    var days = options.expires, t = options.expires = new Date();
                    t.setDate(t.getDate() + days);
                }

                document.cookie = [
                    encodeURIComponent(key) + '=' + String(value),
                    options.expires ? '; expires=' + options.expires.toUTCString() : '',
                    options.path    ? '; path=' + options.path : '',
                    options.domain  ? '; domain=' + options.domain : '',
                    options.secure  ? '; secure' : ''
                ].join('');

                return value;
            }
        },
        applyStyle: function(name) {
            $('#djDebug [data-' + name + ']').each(function() {
                var css = {};
                css[name] = $(this).data(name);
                $(this).css(css);
            });
        }
    };
    $.extend(publicAPI, {
        show_toolbar: djdt.show_toolbar,
        hide_toolbar: djdt.hide_toolbar,
        close: djdt.close,
        cookie: djdt.cookie,
        applyStyle: djdt.applyStyle
    });
    $(document).ready(djdt.init);
})(djdt.jQuery, djdt);
