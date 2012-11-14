window.app = app = window.app || {}
app.config = app.config || {};

jQuery ->

    class BasePage extends Backbone.View
        initialize: ->
            _.bindAll(@)
            @views = {}

            # initialize tab event handlers
            $('a[data-toggle=ajtab]').click (e) =>
                e.preventDefault()

                $tab = $(e.target)
                view_id = $tab.attr('href').substr(1)
                view = @getView(view_id)
                uri = $tab.attr('data-uri')

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

        makeDefaultView: (id) ->
            new app.GroupListView
                className: 'group-list small'
                id: id
                maxItems: 5

        getView: (id) ->
            if !@views[id]
                @views[id] = @makeDefaultView(id)
            return @views[id]

    app.StreamPage = class StreamPage extends BasePage

        initialize: (data) ->
            BasePage.prototype.initialize.call(@)

            @group_list = new app.GroupListView
                className: 'group-list'
                id: 'event_list'
                members: data.groups
                maxItems: 50

            @config =
                realtime: data.realtime ? true

            @cursor = null
            @queue = new app.ScoredList
            @poll()

            window.setInterval(@tick, 300)

        tick: ->
            if !@queue.length
                return

            # ensure "no messages" is cleaned up
            $('#no_messages').remove()

            @group_list.addMember(@queue.pop())

            # # shiny fx
            # $row.css('background-color', '#ddd').animate({backgroundColor: '#fff'}, 1200)

        getPollUrl: ->
            app.config.urlPrefix + '/api/' + app.config.projectId + '/poll/'

        poll: ->
            poll_url = @getPollUrl
            if !@config.realtime
                window.setTimeout(@poll, 1000)
                return

            data = app.utils.getQueryParams()
            data.cursor = @cursor || undefined

            $.ajax
                url: @getPollUrl()
                type: 'get'
                dataType: 'json'
                data: data
                success: (groups) =>
                    if !groups.length
                        setTimeout(@poll, 5000)
                        return

                    @cursor = groups[groups.length - 1].score || undefined

                    for data in groups
                        obj = @queue.get(data.id)
                        if obj
                            # TODO: this code is shared in updateMember above
                            obj.set('count', data.count)
                            obj.set('score', data.score)
                            @queue.sort()
                        else
                            @queue.add(data)

                    window.setTimeout(@poll, 1000)

                error: =>
                    # if an error happened lets give the server a bit of time before we poll again
                    window.setTimeout(@poll, 10000)

    app.DashboardPage = class DashboardPage extends BasePage

        initialize: ->
            BasePage.prototype.initialize.call(@)

            # TODO:
            Sentry.charts.render('#chart')

    app.WallPage = class WallPage extends BasePage

        initialize: ->
            BasePage.prototype.initialize.call(@)

            @$sparkline = $('.chart')
            @$sparkline.height(@$sparkline.parent().height())
            @$stats = $('#stats')

            @refresh()

        refresh: ->
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

            $.ajax
                url: @$stats.attr('data-uri')
                dataType: 'json'
                success: (data) =>
                    @$stats.find('[data-stat]').each ->
                        $this = $(this)
                        $this.find('big').text(data[$this.attr('data-stat')])

# We're not talking to the server
Backbone.sync = (method, model, success, error) ->

    success()