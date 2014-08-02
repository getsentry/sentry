(function(){
    'use strict';

    var appConfig = window.SentryConfig;

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
            return new app.views.GroupListView({
                className: 'events small',
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

    $.extend(app, {
        BasePage: BasePage,

        StreamPage: BasePage.extend({

            initialize: function(data){
                BasePage.prototype.initialize.apply(this, arguments);

                this.group_list = new app.views.GroupListView({
                    className: 'group-list',
                    id: 'event_list',
                    members: data.groups,
                    maxItems: 50,
                    realtime: ($.cookie('pausestream') ? false : true),
                    canStream: this.options.canStream,
                    pollUrl: appConfig.urlPrefix + '/api/' + appConfig.selectedTeam.slug + '/' + appConfig.selectedProject.slug + '/poll/',
                    model: app.models.Group
                });

                this.control = $('a[data-action=pause]');
                this.updateStreamOptions();
                this.initFilters();

                this.control.click(_.bind(function(e){
                    e.preventDefault();
                    this.options.realtime = this.group_list.options.realtime = this.control.hasClass('realtime-paused');
                    this.updateStreamOptions();
                }, this));

                $('#chart').height('50px');
                app.charts.createBasic('#chart', {
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
                    this.control.removeClass('realtime-paused');
                    this.control.attr("title", this.control.attr('data-pause-label'));
                } else {
                    $.cookie('pausestream', '1', {expires: 7});
                    this.control.addClass('realtime-paused');
                    this.control.attr("title", this.control.attr('data-play-label'));
                }
            }

        }),

        DashboardPage: BasePage,

        GroupDetailsPage: BasePage.extend({

            initialize: function(data){
                BasePage.prototype.initialize.apply(this, arguments);

                this.group_list = new app.views.GroupListView({
                    className: 'group-list',
                    id: 'event_list',
                    members: [data.group],
                    model: app.models.Group
                });

                $('#chart').height('150px');
                app.charts.createBasic('#chart');

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

                $('.add-note-form textarea').focus(function () {
                    $(this).addClass('expanded');
                });

                $('.add-note-form textarea').keypress(function (e) {
                    if (e.which == 13 && !e.shiftKey) {
                      $('.add-note-form').submit();
                      return false;
                    }
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
        }),

        WallPage: BasePage.extend({
            initialize: function(){
                BasePage.prototype.initialize.apply(this, {
                    realtime: true,
                    pollTime: 3000
                });

                this.sparkline = $('.chart');
                this.sparkline.height(this.sparkline.parent().height());
                this.stats = $('#stats');

                _.bindAll(this, 'refreshStats', 'refreshSparkline');

                this.refreshSparkline();
                this.refreshStats();
            },

            makeDefaultView: function(id){
                return new app.views.GroupListView({
                    className: 'events',
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
                        since: new Date().getTime() / 1000 - 3600 * 24,
                        resolution: '1h'
                    },
                    success: _.bind(function(data){
                        for (var i = 0; i < data.length; i++) {
                            // set timestamp to be in millis
                            data[i][0] = data[i][0] * 1000;
                        }
                        this.sparkline.empty();
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

                        window.setTimeout(this.refreshSparkline, 10000);
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

        }),

        NewProjectRulePage: BasePage.extend({

            initialize: function(data){
                BasePage.prototype.initialize.apply(this, arguments);

                _.bindAll(this, 'addAction', 'addCondition', 'parseFormData');

                this.actions_by_id = {};
                this.conditions_by_id = {};
                this.el = $(data.el);
                this.action_sel = this.el.find('select[id="action-select"]');
                this.action_table = this.el.find('table.action-list');
                this.action_table_body = this.action_table.find('tbody');
                this.condition_sel = this.el.find('select[id="condition-select"]');
                this.condition_table = this.el.find('table.condition-list');
                this.condition_table_body = this.condition_table.find('tbody');

                this.action_sel.empty();
                this.action_sel.append($('<option></option>'));
                $.each(data.actions, _.bind(function(_, action) {
                    var opt = $('<option></option>');
                    opt.attr({
                        value: action.id
                    });
                    opt.text(action.label);
                    opt.appendTo(this.action_sel);

                    this.actions_by_id[action.id] = action;
                }, this));

                this.condition_sel.empty();
                this.condition_sel.append($('<option></option>'));
                $.each(data.conditions, _.bind(function(_, condition) {
                    var opt = $('<option></option>');
                    opt.attr({
                        value: condition.id
                    });
                    opt.text(condition.label);
                    opt.appendTo(this.condition_sel);

                    this.conditions_by_id[condition.id] = condition;
                }, this));

                this.action_sel.selectize();
                this.condition_sel.selectize();

                this.action_sel.change(_.bind(function(){
                    this.addAction(this.action_sel.val());
                }, this));
                this.condition_sel.change(_.bind(function(){
                    this.addCondition(this.condition_sel.val());
                }, this));

                this.parseFormData(data.form_data, data.form_errors);
            },

            parseFormData: function(form_data, form_errors) {
                // start by parsing into condition/action bits
                var data = {
                        action: {},
                        action_match: form_data.action_match || 'all',
                        condition: {},
                        label: form_data.label || ''
                    };

                form_errors = form_errors || {};

                $.each(form_data, function(key, value){
                    var matches = key.match(/^(condition|action)\[(\d+)\]\[(.+)\]$/);
                    var type, num;
                    if (!matches) {
                        return;
                    }
                    type = matches[1];
                    num = matches[2];
                    if (data[type][num] === undefined) {
                        data[type][num] = {};
                    }
                    data[type][num][matches[3]] = value;
                });

                this.el.find('input[name=label]').val(data.label);
                this.el.find('select[name="action_match"]').val(data.action_match);

                $.each(_.sortBy(data.condition), _.bind(function(num, item){
                    this.addCondition(item.id, item, form_errors['condition[' + num + ']'] || false);
                }, this));
                $.each(_.sortBy(data.action), _.bind(function(num, item){
                    this.addAction(item.id, item, form_errors['action[' + num + ']'] || false);
                }, this));
            },

            addCondition: function(id, options, has_errors) {
                var node = this.conditions_by_id[id],
                    row = $('<tr></tr>'),
                    remove_btn = $('<button class="btn btn-default btn-sm"><span class="icon-trash"></span></button>'),
                    num = this.condition_table_body.find('tr').length,
                    html = $('<div>' + node.html + '</div>'),
                    prefix = 'condition[' + num + ']',
                    id_field = $('<input type="hidden" name="' + prefix + '[id]" value="' + node.id + '">');

                has_errors = has_errors || false;
                options = options || {};

                if (has_errors) {
                    row.addClass('error');
                }

                html.find('select').selectize();

                // we need to update the id of all form elements
                html.find('input, select, textarea').each(function(_, el){
                    var $el = $(el),
                        name = $el.attr('name');
                    $el.attr('name', prefix + '[' + name + ']');
                    $el.val(options[name] || '');
                });
                row.append($('<td></td>').append(html).append(id_field));
                row.append($('<td class="align-right"></td>').append(remove_btn));
                row.appendTo(this.condition_table_body);

                remove_btn.click(function(){
                    row.remove();
                    return false;
                });

                this.condition_sel.data("selectize").clear();
                this.condition_table.show();
            },

            addAction: function(id, options, has_errors) {
                var node = this.actions_by_id[id],
                    row = $('<tr></tr>'),
                    remove_btn = $('<button class="btn btn-default btn-sm"><span class="icon-trash"></span></button>'),
                    num = this.action_table_body.find('tr').length,
                    html = $('<div>' + node.html + '</div>'),
                    prefix = 'action[' + num + ']',
                    id_field = $('<input type="hidden" name="' + prefix + '[id]" value="' + node.id + '">');

                has_errors = has_errors || false;
                options = options || {};

                if (has_errors) {
                    row.addClass('error');
                }

                html.find('select').selectize();

                // we need to update the id of all form elements
                html.find('input, select, textarea').each(function(_, el){
                    var $el = $(el),
                        name = $el.attr('name');
                    $el.attr('name', prefix + '[' + name + ']');
                    $el.val(options[name] || '');
                });
                row.append($('<td></td>').append(html).append(id_field));
                row.append($('<td class="align-right"></td>').append(remove_btn));
                row.appendTo(this.action_table_body);

                remove_btn.click(function(){
                    row.remove();
                    return false;
                });

                this.action_sel.data("selectize").clear();
                this.action_table.show();
            }

        })
    });
}());
