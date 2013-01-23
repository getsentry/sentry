/*global Sentry:true*/

(function(window, app, Backbone, jQuery, _){
    "use strict";

    var $ = jQuery;
    var BasePage = Backbone.View.extend({

        defaults: {
            // can this view stream updates?
            canStream: false,
            // should this view default to streaming updates?
            realtime: false
        },

        initialize: function(data){
            _.bindAll(this);

            if (_.isUndefined(data))
                data = {};

            this.options = $.extend({}, this.defaults, this.options, data);

            this.views = {};
            this.initializeAjaxTabs();
        },

        initializeAjaxTabs: function(){
            $('a[data-toggle=ajtab]').click(_.bind(function(e){
                var $tab = $(e.target),
                    uri = $tab.attr('data-uri'),
                    view_id = $tab.attr('href').substr(1),
                    view = this.getView(view_id, uri),
                    $cont, $parent;

                e.preventDefault();

                if (!uri)
                    return view.reset();

                $cont = $('#' + view_id);
                $parent = $cont.parent();
                $parent.css('opacity', 0.6);

                $.ajax({
                    url: uri,
                    dataType: 'json',
                    success: function(data){
                        view.reset(data);
                        $parent.css('opacity', 1);
                        $tab.tab('show');
                    },
                    error: function(){
                        $cont.html('<p>There was an error fetching data from the server.</p>');
                    }
                });
            }, this));

            // initialize active tabs
            $('li.active a[data-toggle=ajtab]').click();
        },

        makeDefaultView: function(id){
            return new app.GroupListView({
                className: 'group-list small',
                id: id,
                maxItems: 5,
                stream: this.options.stream,
                realtime: this.options.realtime,
                model: app.models.Group
            });
        },

        getView: function(id, uri){
            if (!this.views[id])
                this.views[id] = this.makeDefaultView(id);
            var view = this.views[id];
            view.options.pollUrl = uri;
            return view;
        }

    });

    app.StreamPage = BasePage.extend({

        initialize: function(data){
            BasePage.prototype.initialize.call(this, data);

            this.group_list = new app.GroupListView({
                className: 'group-list',
                id: 'event_list',
                members: data.groups,
                maxItems: 50,
                realtime: ($.cookie('pausestream') ? false : true),
                canStream: this.options.canStream,
                pollUrl: app.config.urlPrefix + '/api/' + app.config.projectId + '/poll/',
                model: app.models.Group
            });

            this.control = $('a[data-action=pause]');
            this.updateStreamOptions();

            this.control.click(_.bind(function(e){
                e.preventDefault();
                this.options.realtime = this.group_list.options.realtime = this.control.hasClass('realtime-pause');
                this.updateStreamOptions();
            }, this));

            $('#chart').height('50px');
            app.charts.render('#chart', {
                placement: 'left'
            });
        },

        updateStreamOptions: function(){
            if (this.options.realtime){
                $.removeCookie('pausestream');
                this.control.removeClass('realtime-pause');
                this.control.addClass('realtime-play');
                this.control.html(this.control.attr('data-pause-label'));
            } else {
                $.cookie('pausestream', '1', {expires: 7});
                this.control.addClass('realtime-pause');
                this.control.removeClass('realtime-play');
                this.control.html(this.control.attr('data-play-label'));
            }
        }

    });

    app.DashboardPage = BasePage.extend({

        initialize: function(data){
            BasePage.prototype.initialize.call(this, data);

            $('#chart').height('200px');
            Sentry.charts.render('#chart');
        }

    });

    app.GroupDetailsPage = BasePage.extend({

        initialize: function(data){
            BasePage.prototype.initialize.call(this, data);

            this.group_list = new app.GroupListView({
                className: 'group-list',
                id: 'event_list',
                members: [data.group],
                model: app.models.Group
            });

            $('#chart').height('200px');
            Sentry.charts.render('#chart');

            $('#public-status .action').click(function(){
                var $this = $(this);
                $.ajax({
                    url: $this.attr('data-api-url'),
                    type: 'post',
                    success: function(group){
                        var selector = (group.isPublic ? 'true' : 'false');
                        var nselector = (group.isPublic ? 'false' : 'true');
                        $('#public-status span[data-public="' + selector + '"]').show();
                        $('#public-status span[data-public="' + nselector + '"]').hide();
                    },
                    error: function(){
                        window.alert('There was an error changing the public status');
                    }
                });
            });

            var $event_nav = $('#event_nav');
            if ($event_nav) {
                var $window = $(window);
                var $nav_links = $event_nav.find('a[href*=#]');
                var $nav_targets = [];
                var scroll_offset = $event_nav.offset().top;
                var event_nav_height;
                var last_target;

                $nav_links.click(function(e){
                    var $el = $(this);
                    var target = $(this.hash);

                    $el.parent().addClass('active').siblings().removeClass('active');

                    $('html,body').animate({
                        scrollTop: $(target).position().top + event_nav_height + 20
                    }, 'fast');

                    e.preventDefault();
                }).each(function(){
                    if (this.hash.length > 1 && $(this.hash).length) {
                        $nav_targets.push(this.hash);
                    }
                });

                $window.resize(function(){
                    event_nav_height = $event_nav.find('.nav').outerHeight();
                    $event_nav.height(event_nav_height + 'px');
                }).resize();

                $window.scroll(function(){
                    // Change fixed nav if needed
                    if ($window.scrollTop() > scroll_offset) {
                        if (!$event_nav.hasClass('fixed')) {
                            $event_nav.addClass('fixed');
                        }
                    } else if ($event_nav.hasClass('fixed')) {
                        $event_nav.removeClass('fixed');
                    }

                    if ($nav_targets.length) {
                        // Get container scroll position
                        var from_top = $window.scrollTop() + event_nav_height + 20;
                       
                        // Get id of current scroll item
                        var cur = $.map($nav_targets, function(hash){
                            if ($(hash).offset().top < from_top) {
                                return hash;
                            }
                        });

                        // Get the id of the current element
                        var target = cur ? cur[cur.length - 1] : null;

                        if (!target) {
                            target = $nav_targets[0];
                        }

                        if (last_target !== target) {
                           last_target = target;

                           // Set/remove active class
                           $nav_links
                             .parent().removeClass("active")
                             .end().filter("[href=" + target + "]").parent().addClass("active");
                        }  
                    }
                }).scroll();
            }
        }
    });

    app.NewProjectPage = BasePage.extend({

        initialize: function(data){
            this.el = $(data.el);

            BasePage.prototype.initialize.call(this, data);

            this.el.find('select').select2({width: 'element'});

            if (this.options.canSelectTeam && this.options.canCreateTeam) {
                $('#new_team').hide();
                $('a[rel="create-new-team"]').click(function(){
                    $('#new_team').show();
                    $('#select_team').hide();
                });
                $('a[rel="select-team"]').click(function(){
                    $('#new_team').hide();
                    $('#select_team').show();
                });
            }
        }

    });

    app.WallPage = BasePage.extend({

        initialize: function(){
            BasePage.prototype.initialize.call(this, {
                realtime: true,
                pollTime: 3000
            });

            this.sparkline = $('.chart');
            this.sparkline.height(this.sparkline.parent().height());
            this.stats = $('#stats');

            this.refreshSparkline();
            this.refreshStats();
        },

        refreshSparkline: function(){
            $.ajax({
                url: this.sparkline.attr('data-api-url'),
                type: 'get',
                dataType: 'json',
                data: {
                    days: 1,
                    gid: this.sparkline.attr('data-group') || undefined
                },
                success: _.bind(function(data){
                    $.plot(this.sparkline, [{
                            data: data,
                            color: '#52566c',
                            shadowSize: 0,
                            lines: {
                                lineWidth: 2,
                                show: true,
                                fill: true,
                                fillColor: '#232428'
                            }
                        }], {
                            yaxis: {
                                min: 0
                            },
                            grid: {
                                show: false
                            },
                            hoverable: false,
                            legend: {
                                noColumns: 5
                            },
                            lines: {
                                show: false
                            }
                        }
                    );
                }, this)
            });
        },

        refreshStats: function(){
            $.ajax({
                url: this.stats.attr('data-uri'),
                dataType: 'json',
                success: _.bind(function(data){
                    this.stats.find('[data-stat]').each(function(){
                        var $this = $(this);
                        $this.find('big').text(data[$this.attr('data-stat')]);
                    });
                    window.setTimeout(this.refreshStats, 1000);
                }, this)
            });
        }

    });

    app.UserListPage = BasePage.extend({

        initialize: function(data){
            BasePage.prototype.initialize.call(this, data);

            this.list = new app.UserListView({
                className: 'user-list',
                id: 'user_list',
                members: data.users
            });
        }

    });

    Backbone.sync = function(method, model, success, error){
        success();
    };
}(window, app, Backbone, jQuery, _));