(function(app, Backbone, jQuery, _){
    "use strict";

    var $ = jQuery;

    app.GroupView = Backbone.View.extend({
        tagName: 'li',
        className: 'group',
        template: _.template(app.templates.group),

        initialize: function(){
            _.bindAll(this);
            this.model.on('change:count', this.updateCount);
            this.model.on('change:lastSeen', this.updateLastSeen);
            this.model.on('change:isBookmarked', this.render);
            this.model.on('change:isResolved', this.render);
            this.model.on('change:historicalData', this.renderSparkline);
        },

        render: function(){
            var data = this.model.toJSON();
            this.$el.html(this.template(data));
            this.$el.attr('data-id', this.model.id);
            this.$el.addClass(this.getLevelClassName());
            if (this.model.get('isResolved')) {
                this.$el.addClass('resolved');
            }
            this.$el.find('a[data-action=resolve]').click(_.bind(function(e){
                e.preventDefault();
                this.resolve();
            }, this));
            this.$el.find('a[data-action=bookmark]').click(_.bind(function(e){
                e.preventDefault();
                this.bookmark();
            }, this));
            this.renderSparkline();
        },

        renderSparkline: function(obj){
            var data = this.model.get('historicalData');
            if (!data || !data.length)
                return;

            this.$el.addClass('with-sparkline');

            app.charts.createSparkline(this.$el.find('.sparkline'), data);
        },

        getResolveUrl: function(){
            return app.config.urlPrefix + '/api/' + app.config.projectId + '/resolve/';
        },

        resolve: function(){
            $.ajax({
                url: this.getResolveUrl(),
                type: 'post',
                dataType: 'json',
                data: {
                    gid: this.model.get('id')
                },
                success: _.bind(function(response) {
                    this.model.set('isResolved', true);
                }, this)
            });
        },

        getBookmarkUrl: function(){
            return app.config.urlPrefix + '/api/' + app.config.projectId + '/bookmark/';
        },

        bookmark: function(){
            $.ajax({
                url: this.getBookmarkUrl(),
                type: 'post',
                dataType: 'json',
                data: {
                    gid: this.model.get('id')
                },
                success: _.bind(function(response){
                    this.model.set('isBookmarked', response.isBookmarked);
                }, this)
            });
        },

        getLevelClassName: function(){
            return 'level-' + this.model.get('levelName');
        },

        updateLastSeen: function(){
            this.$el.find('.last-seen')
                .text(app.utils.prettyDate(this.model.get('lastSeen')))
                .attr('title', this.model.get('lastSeen'));
        },

        updateCount: function(){
            var new_count = app.utils.formatNumber(this.model.get('count'));
            var counter = this.$el.find('.count');
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
        }

    });

    app.OrderedElementsView = Backbone.View.extend({

        emptyMessage: '<p>There is nothing to show here.</p>',
        loadingMessage: '<p>Loading...</p>',
        model: app.models.Group,

        defaults: {
            maxItems: 50
        },

        initialize: function(data){
            var members = data.members;

            _.bindAll(this);

            this.options = $.extend({}, this.defaults, this.options, data);

            this.$wrapper = $('#' + this.id);
            this.$parent = $('<ul></ul>');
            this.$empty = $('<li class="empty"></li>');
            this.$wrapper.html(this.$parent);

            if (this.options.className)
                this.$parent.addClass(this.options.className);

            this.collection = new app.ScoredList();
            this.collection.on('add', this.renderMemberInContainer);
            this.collection.on('remove', this.unrenderMember);
            this.collection.on('reset', this.reSortMembers);

            delete data.members;

            this.reset(members);
        },

        reset: function(members){
            this.$parent.empty();
            this.setEmpty();

            if (members === undefined) {
                this.$empty.html(this.loadingMessage);
                this.collection.reset();
                this.setEmpty();
                this.loaded = false;
            } else {
                this.$empty.html(this.emptyMessage);
                this.collection.reset(members);
                this.loaded = true;
            }
        },

        setEmpty: function(){
            this.$parent.html(this.$empty);
        },

        extend: function(data){
            for (var i=0; i<data.length; i++) {
                this.addMember(data[i]);
            }
        },

        addMember: function(member){
            if (member.get === undefined) {
                member = new this.model(member);
            }

            if (!this.hasMember(member)) {
                if (this.collection.models.length >= (this.options.maxItems - 1))
                    // bail early if the score is too low
                    if (member.get('score') < this.collection.last().get('score'))
                        return;

                    // make sure we limit the number shown
                    while (this.collection.models.length >= this.options.maxItems)
                        this.collection.pop();

                this.collection.add(member);
            } else {
                this.updateMember(member);
            }
        },

        reSortMembers: function(){
            this.collection.each(_.bind(function(member){
                this.renderMemberInContainer(member);
            }, this));
        },

        updateMember: function(member, options){
            if (_.isUndefined(options))
                options = {};

            var existing = this.collection.get(member.id);
            for (var key in member.attributes) {
                if (existing.get(key) != member.get(key)) {
                    existing.set(key, member.get(key));
                }
            }

            if (options.sort !== false) {
                // score changed, resort
                this.collection.sort();
            }
        },

        hasMember: function(member){
            return (this.collection.get(member.id) ? true : false);
        },

        removeMember: function(member){
            this.collection.remove(member);
        },

        renderMemberInContainer: function(member){
            var new_pos = this.collection.indexOf(member),
                $el, $rel;

            this.$parent.find('li.empty').remove();

            $el = $('#' + this.id + member.id);

            if (!$el.length) {
                // create the element if it does not yet exist
                $el = this.renderMember(member);
            } else if ($el.index() === new_pos) {
                // if the row was already present, ensure it moved
                return;
            }

            // top item
            if (new_pos === 0) {
                this.$parent.prepend($el);
            } else {
                // find existing item at new position
                $rel = $('#' + this.id + this.collection.at(new_pos).id);
                if (!$rel.length) {
                    this.$parent.append($el);
                } else if ($el.id !== $rel.id) {
                    // TODO: why do we get here?
                    $el.insertBefore($rel);
                } else {

                    return;
                }
            }

            if (this.loaded)
                $el.css('background-color', '#eee').animate({backgroundColor: '#fff'}, 1200);
        },

        renderMember: function(member){
            var view = new app.GroupView({
                model: member,
                id: this.id + member.id
            });
            view.render();
            return view.$el;
        },

        unrenderMember: function(member){
            $('#' + this.id + member.id).remove();
            if (!this.$parent.find('li').length)
                this.setEmpty();
        }

    });


    app.GroupListView = app.OrderedElementsView.extend({

        defaults: {
            realtime: false,
            stream: false,
            pollUrl: null,
            pollTime: 1000,
            tickTime: 100
        },

        initialize: function(data){
            if (_.isUndefined(data))
                data = {};

            data.model = app.models.Group;
            
            app.OrderedElementsView.prototype.initialize.call(this, data);

            this.options = $.extend({}, this.defaults, this.options, data);

            this.queue = new app.ScoredList();

            this.cursor = null;

            this.poll();

            window.setInterval(this.tick, this.options.tickTime);
        },

        tick: function(){
            if (!this.queue.length)
                return;

            var item = this.queue.pop();
            if (this.options.canStream){
                this.addMember(item);
            } else if (this.hasMember(item)) {
                this.updateMember(item, {
                    sort: false
                });
            }
        },

        poll: function(){
            var data;

            if (!this.options.realtime || !this.options.pollUrl)
                return window.setTimeout(this.poll, this.options.pollTime);

            data = app.utils.getQueryParams();
            data.cursor = this.cursor || undefined;

            $.ajax({
                url: this.options.pollUrl,
                type: 'get',
                dataType: 'json',
                data: data,
                success: _.bind(function(groups){
                    var i, data, obj;

                    if (!groups.length)
                        return setTimeout(this.poll, this.options.pollTime * 5);

                    this.cursor = groups[groups.length - 1].score || undefined;

                    for (i=0; (data = groups[i]); i+=1) {
                        obj = this.queue.get(data.id);
                        if (!_.isUndefined(obj)) {
                            // TODO: this code is shared in updateMember above
                            obj.set('count', data.count);
                            obj.set('score', data.score);
                            this.queue.sort();
                        } else {
                            this.queue.add(data);
                        }
                    }

                    window.setTimeout(this.poll, this.options.pollTime);
                }, this),
                error: _.bind(function(){
                    // if an error happened lets give the server a bit of time before we poll again
                    window.setTimeout(this.poll, this.options.pollTime * 10);
                }, this)
            });
        }

    });

    app.UserListView = app.OrderedElementsView.extend({

        defaults: {
        },

        initialize: function(data){
            if (_.isUndefined(data))
                data = {};

            data.model = app.User;
            
            app.OrderedElementsView.prototype.initialize.call(this, data);

            this.options = $.extend({}, this.defaults, this.options, data);
        }

    });

}(app, Backbone, jQuery, _));
