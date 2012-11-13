window.app = app = window.app || {}
app.config = app.config || {};

jQuery ->

    app.StreamPage = class StreamPage extends Backbone.View

        initialize: (data) ->
            _.bindAll(@)

            @group_list = new app.OrderedElementsView
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

    app.DashboardPage = class DashboardPage extends Backbone.View

        initialize: ->
            _.bindAll(@)

            @views = {}

            # TODO:
            Sentry.charts.render('#chart')

            # initialize tab event handlers
            $('a[data-toggle=ajtab]').click (e) =>
                $tab = $(e.target)
                view_id = $tab.attr('href').substr(1)
                view = @getView(view_id)
                uri = $tab.attr('data-uri')

                if (!uri)
                    view.load()
                    return

                $cont = $(name)
                $parent = $cont.parent()

                $parent.css('opacity', .6)
                e.preventDefault()

                # load content for selected tab
                $.ajax
                    url: uri
                    dataType: 'json'
                    success: (data) =>
                        view.load(data)
                        $parent.css('opacity', 1)
                        $tab.tab('show')
                    # error: ->
                    #     $cont.html('<p>{% trans "There was an error fetching data from the server." %}</p>')
    
            # initialize active tabs
            $('li.active a[data-toggle=ajtab]').click()

        getView: (id) ->
            if !@views[id]
                @views[id] = new app.OrderedElementsView
                    className: 'group-list small'
                    id: id
                    maxItems: 5
            return @views[id]

# We're not talking to the server
Backbone.sync = (method, model, success, error) ->

    success()