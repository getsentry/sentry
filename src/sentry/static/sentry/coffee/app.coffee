window.app = app = window.app || {}
app.config = app.config || {};

jQuery ->

    class BasePage extends Backbone.View
        initialize: (data) ->
            _.bindAll(@)

            if !data?
                data = {}

            @config =
                realtime: data.realtime ? false
            @views = {}

            @initializeAjaxTabs()

        initializeAjaxTabs: ->
            # initialize tab event handlers
            $('a[data-toggle=ajtab]').click (e) =>
                e.preventDefault()

                $tab = $(e.target)
                uri = $tab.attr('data-uri')
                view_id = $tab.attr('href').substr(1)
                view = @getView(view_id, uri)

                if (!uri)
                    view.load()
                    return

                $cont = $('#' + view_id)
                $parent = $cont.parent()

                $parent.css('opacity', .6)

                # load content for selected tab
                $.ajax
                    url: uri
                    dataType: 'json'
                    success: (data) =>
                        view.load(data)
                        $parent.css('opacity', 1)
                        $tab.tab('show')

                        if $cont.find('.sparkline canvas').length == 0
                            $cont.find('.sparkline').each (_, el) =>
                                # TODO: find a way to not run this check each time
                                $(el).sparkline 'html'
                                    enableTagOptions: true
                                    height: $(el).height()

                    error: ->
                        $cont.html('<p>There was an error fetching data from the server.</p>')
    
            # initialize active tabs
            $('li.active a[data-toggle=ajtab]').click()

        makeDefaultView: (id, uri) ->
            new app.GroupListView
                className: 'group-list small'
                id: id
                maxItems: 5
                pollUrl: uri
                realtime: @config.realtime

        getView: (id, uri) ->
            if !@views[id]
                @views[id] = @makeDefaultView(id, uri)
            return @views[id]

    app.StreamPage = class StreamPage extends BasePage

        initialize: (data) ->
            BasePage.prototype.initialize.call(@, data)

            @group_list = new app.GroupListView
                className: 'group-list'
                id: 'event_list'
                members: data.groups
                maxItems: 50
                realtime: true
                pollUrl: app.config.urlPrefix + '/api/' + app.config.projectId + '/poll/'

            $('a[data-action=pause]').click (e) =>
                e.preventDefault()
                $target = $(e.target)
                if $target.hasClass('realtime-pause')
                    @group_list.config.realtime = true
                    $target.removeClass('realtime-pause')
                    $target.addClass('realtime-play')
                    $target.html($target.attr('data-pause-label'))
                else
                    @group_list.config.realtime = false
                    $target.addClass('realtime-pause')
                    $target.removeClass('realtime-play')
                    $target.html($target.attr('data-play-label'))


    app.DashboardPage = class DashboardPage extends BasePage

        initialize: (data) ->
            BasePage.prototype.initialize.call(@, data)

            # TODO:
            Sentry.charts.render('#chart')

    app.WallPage = class WallPage extends BasePage

        initialize: ->
            BasePage.prototype.initialize.call(@,
                realtime: true
                pollTime: 3000
            )

            @$sparkline = $('.chart')
            @$sparkline.height(@$sparkline.parent().height())
            @$stats = $('#stats')

            @refreshSparkline()
            @refreshStats()

        refreshSparkline: ->
            $.ajax
                url: @$sparkline.attr('data-api-url'),
                type: 'get'
                dataType: 'json'
                data:
                    days: 1
                    gid: @$sparkline.attr('data-group') || undefined

                success: (data) =>
                    $.plot(@$sparkline, [
                            data: data
                            color: '#52566c'
                            shadowSize: 0
                            lines:
                                lineWidth: 2
                                show: true
                                fill: true
                                fillColor: '#232428'
                        ],
                        yaxis:
                           min: 0
                        grid:
                            show: false
                        hoverable: false
                        legend:
                            noColumns: 5
                        lines:
                            show: false
                    )

        refreshStats: ->
            $.ajax
                url: @$stats.attr('data-uri')
                dataType: 'json'
                success: (data) =>
                    @$stats.find('[data-stat]').each ->
                        $this = $(this)
                        $this.find('big').text(data[$this.attr('data-stat')])
                    window.setTimeout(@refreshStats, 1000)

# We're not talking to the server
Backbone.sync = (method, model, success, error) ->

    success()