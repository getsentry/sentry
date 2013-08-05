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
            Backbone.View.prototype.initialize.apply(this, arguments);

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
            BasePage.prototype.initialize.apply(this, arguments);

            this.group_list = new app.GroupListView({
                className: 'group-list',
                id: 'event_list',
                members: data.groups,
                maxItems: 50,
                realtime: ($.cookie('pausestream') ? false : true),
                canStream: this.options.canStream,
                pollUrl: app.config.urlPrefix + '/api/' + app.config.teamId + '/' + app.config.projectId + '/poll/',
                model: app.models.Group
            });

            this.control = $('a[data-action=pause]');
            this.updateStreamOptions();
            this.initFilters();

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

        initFilters: function(){
            $('.filter').each(_.bind(function(_, el){
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
                            url: app.utils.getSearchTagsUrl(),
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
                                        id: app.utils.escape(val),
                                        text: app.utils.escape(val)
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
            }, this));
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
            BasePage.prototype.initialize.apply(this, arguments);

            $('#chart').height('150px');
            Sentry.charts.render('#chart');
        }

    });

    app.SelectTeamPage = BasePage.extend({

        initialize: function(){
            BasePage.prototype.initialize.apply(this, arguments);

            this.refreshSparklines();
            $(window).on('resize', this.refreshSparklines);
        },

        refreshSparklines: function(){
            $('.chart').each(function(n, el){
                var $el = $(el);
                $.ajax({
                    url: $el.attr('data-api-url'),
                    type: 'get',
                    dataType: 'json',
                    data: {
                        days: 1
                    },
                    success: _.bind(function(data){
                        $.plot($el, [{
                                data: data,
                                color: '#ebeff3',
                                shadowSize: 0,
                                lines: {
                                    lineWidth: 2,
                                    show: true,
                                    fill: true,
                                    color: '#f6f8fa'
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
            });
        }

    });

    app.GroupDetailsPage = BasePage.extend({

        initialize: function(data){
            BasePage.prototype.initialize.apply(this, arguments);

            this.group_list = new app.GroupListView({
                className: 'group-list',
                id: 'event_list',
                members: [data.group],
                model: app.models.Group
            });

            $('#chart').height('150px');
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
            if ($event_nav.length > 0) {
                var $window = $(window);
                var $nav_links = $event_nav.find('a[href*=#]');
                var $nav_targets = [];
                var scroll_offset = $event_nav.offset().top;
                var event_nav_height;
                var last_target;

                $window.resize(function(){
                    event_nav_height = $event_nav.find('.nav').outerHeight();
                    $event_nav.height(event_nav_height + 'px');
                }).resize();

                $nav_links.click(function(e){
                    var $el = $(this);
                    var target = $(this.hash);

                    $el.parent().addClass('active').siblings().removeClass('active');

                    $('html,body').animate({
                        scrollTop: target.position().top + event_nav_height
                    }, 'fast');

                    if (history.pushState) {
                        history.pushState({}, '', this.hash);
                    }

                    e.preventDefault();
                }).each(function(){
                    if (this.hash.length > 1 && $(this.hash).length) {
                        $nav_targets.push(this.hash);
                    }
                });

                var resizeTimer;
                $window.scroll(function(){
                    clearTimeout(resizeTimer);
                    resizeTimer = setTimeout(function(){
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
                    }, 1);
                }).scroll();
            }
        }
    });

    app.WallPage = BasePage.extend({
        initialize: function(){
            BasePage.prototype.initialize.apply(this, {
                realtime: true,
                pollTime: 3000
            });

            this.sparkline = $('.chart');
            this.sparkline.height(this.sparkline.parent().height());
            this.stats = $('#stats');

            _.bindAll(this, 'refreshStats');

            this.refreshSparkline();
            this.refreshStats();
        },

        makeDefaultView: function(id){
            return new app.GroupListView({
                className: 'group-list',
                id: id,
                maxItems: 5,
                stream: this.options.stream,
                realtime: this.options.realtime,
                model: app.models.Group
            });
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
                        var new_count = data[$this.attr('data-stat')];
                        var counter = $this.find('big');
                        var digit = counter.find('span');

                        if (digit.is(':animated'))
                            return false;

                        if (counter.data('count') == new_count) {
                            // We are already showing this number
                            return false;
                        }

                        counter.data('count', new_count);

                        var replacement = $('<span></span>', {
                            css: {
                                top: '-2.1em',
                                opacity: 0
                            },
                            text: new_count
                        });

                        // The .static class is added when the animation
                        // completes. This makes it run smoother.

                        digit.before(replacement).animate({
                            top: '2.5em',
                            opacity: 0
                        }, 'fast', function(){
                            digit.remove();
                        });

                        replacement.delay(100).animate({
                            top: 0,
                            opacity: 1
                        }, 'fast');

                    });
                    window.setTimeout(this.refreshStats, 1000);
                }, this)
            });
        }

    });

    app.AddTeamMemberPage = BasePage.extend({
    });

    app.AccessGroupMembersPage = BasePage.extend({
        initialize: function(){
            BasePage.prototype.initialize.apply(this, arguments);

            app.utils.makeSearchableUsersInput('form input[name=user]');
        }
    });

    app.AccessGroupProjectsPage = BasePage.extend({
        initialize: function(){
            BasePage.prototype.initialize.apply(this, arguments);

            app.utils.makeSearchableProjectsInput('form input[name=project]');
        }
    });

    app.TeamDetailsPage = BasePage.extend({
        initialize: function(){
            BasePage.prototype.initialize.apply(this, arguments);

            app.utils.makeSearchableUsersInput('form input[name=owner]');
        }
    });

    app.ProjectDetailsPage = BasePage.extend({
        initialize: function(){
            BasePage.prototype.initialize.apply(this, arguments);

            app.utils.makeSearchableUsersInput('form input[name=owner]');

            $("input[type=range]").each(_.bind(function loop(n, el){
                var $el = $(el),
                    min = parseInt($el.attr('min'), 10),
                    max = parseInt($el.attr('max'), 10),
                    step = parseInt($el.attr('step'), 10),
                    values = [],
                    $value = $('<span class="value"></span>');

                var i = min;
                while (i <= max) {
                    values.push(i);
                    if (i < 12) {
                        i += 1;
                    } else if (i < 24) {
                        i += 3;
                    } else if (i < 36) {
                        i += 6;
                    } else if (i < 48) {
                        i += 12;
                    } else {
                        i += 24;
                    }
                }

                $el.on("slider:ready", _.bind(function sliderready(event, data) {
                    $value.appendTo(data.el);
                    $value.html(this.formatHours(data.value));
                }, this)).on("slider:changed", _.bind(function sliderchanged(event, data) {
                    $value.html(this.formatHours(data.value));
                }, this)).simpleSlider({
                    range: [min, max],
                    step: step,
                    allowedValues: values,
                    snap: true
                });
            }, this));
        },

        formatHours: function formatHours(val) {
            val = parseInt(val, 10);
            if (val === 0) {
                return 'Disabled';
            } else if (val > 23 && val % 24 === 0) {
                val = (val / 24);
                return val + ' day' + (val != 1 ? 's' : '');
            }
            return val + ' hour' + (val != 1 ? 's' : '');
        }
    });

    app.ProjectNotificationsPage = BasePage.extend({
        initialize: function(){
            BasePage.prototype.initialize.apply(this, arguments);

            $("input[type=range]").each(_.bind(function loop(n, el){
                var $el = $(el),
                    min = parseInt($el.attr('min'), 10),
                    max = parseInt($el.attr('max'), 10),
                    step = parseInt($el.attr('step'), 10),
                    $value = $('<span class="value"></span>');

                $el.on("slider:ready", _.bind(function sliderready(event, data) {
                    $value.appendTo(data.el);
                    $value.html(this.formatThreshold(data.value));
                }, this)).on("slider:changed", _.bind(function sliderchanged(event, data) {
                    $value.html(this.formatThreshold(data.value));
                }, this)).simpleSlider({
                    range: [min, max],
                    step: step,
                    snap: true
                });
            }, this));

            $("#tag_list input").each(function(_, el){
                $(el).addClass('span6');
                app.utils.makeSearchableTagsInput(el);
            });
        },

        formatThreshold: function formatThreshold(value) {
            if (!value) {
                return 'Disabled';
            }
            return value + '%';
        }

    });

    app.NewProjectPage = BasePage.extend({

        initialize: function(data){
            this.el = $(data.el);

            BasePage.prototype.initialize.apply(this, arguments);

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

    Backbone.sync = function(method, model, success, error){
        success();
    };
}(window, app, Backbone, jQuery, _));
