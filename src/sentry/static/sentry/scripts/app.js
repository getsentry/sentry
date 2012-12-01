/*global Sentry:true*/

(function(app, Backbone, jQuery, _){
    "use strict";

    var $ = jQuery;
    var BasePage = Backbone.View.extend({

        initialize: function(data){
            _.bindAll(this);

            if (data === undefined)
                data = {};

            this.config = {
                realtime: data.realtime || false
            };
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
                    return view.load();

                $cont = $('#' + view_id);
                $parent = $cont.parent();
                $parent.css('opacity', 0.6);

                $.ajax({
                    url: uri,
                    dataType: 'json',
                    success: function(data){
                        view.load(data);
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

        makeDefaultView: function(id, uri){
            return new app.GroupListView({
                className: 'group-list small',
                id: id,
                maxItems: 5,
                pollUrl: uri,
                realtime: this.config.realtime,
                model: app.Group
            });
        },

        getView: function(id, uri){
            if (!this.views[id])
                this.views[id] = this.makeDefaultView(id, uri);
            return this.views[id];
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
                pollUrl: app.config.urlPrefix + '/api/' + app.config.projectId + '/poll/',
                model: app.Group
            });

            this.control = $('a[data-action=pause]');
            this.updateStreamOptions();

            this.control.click(_.bind(function(e){
                e.preventDefault();
                this.group_list.config.realtime = this.control.hasClass('realtime-pause');
                this.updateStreamOptions();
            }, this));
        },

        updateStreamOptions: function(){
            if (this.group_list.config.realtime){
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

            // TODO: abstract this out into our newer components
            Sentry.charts.render('#chart');
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

    Backbone.sync = function(method, model, success, error){
        success();
    };
}(app, Backbone, jQuery, _));