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
            if (this.model.get('isResolved'))
                this.$el.addClass('resolved');
            if (this.model.get('historicalData'))
                this.$el.addClass('with-sparkline');
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
            if (!data)
                return;

            app.utils.createSparkline(this.$el.find('.sparkline'), data);
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
                    this.model.set('isBookmarked', response.bookmarked);
                }, this)
            });
        },

        getLevelClassName: function(){
            return 'level-' + this.model.get('levelName');
        },

        updateLastSeen: function(){
            this.$el.find('.last-seen').text(app.utils.prettyDate(this.model.get('lastSeen')));
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

        initialize: function(data){
            _.bindAll(this);

            this.$wrapper = $('#' + this.id);
            this.$parent = $('<ul></ul>');
            this.$empty = $('<li class="empty"></li>');

            var loaded = (data.members !== undefined);
            if (loaded)
                this.$empty.html(this.$emptyMessage);
            else
                this.$empty.html(this.loadingMessage);
            this.setEmpty();
            this.$wrapper.html(this.$parent);

            if (data.className)
                this.$parent.addClass(data.className);

            // TODO: we can use bindAll to make this more sane
            this.config = {
                maxItems: data.maxItems || 50
            };

            this.collection = new app.ScoredList();
            this.collection.add(data.members || []);
            this.collection.on('add', this.renderMemberInContainer);
            this.collection.on('remove', this.unrenderMember);
            this.collection.on('reset', this.reSortMembers);
            this.collection.sort();

            // we set this last as it has side effects
            this.loaded = loaded;
        },

        load: function(data){
            this.$empty.html(this.emptyMessage);
            if (data)
                this.extend(data);
            else
                this.setEmpty();
            this.loaded = true;
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
            if (!this.hasMember(member)) {
                if (this.collection.models.length >= (this.config.maxItems - 1))
                    // bail early if the score is too low
                    if (member.get('score') < this.collection.last().get('score'))
                        return;

                    // make sure we limit the number shown
                    while (this.collection.models.length >= this.config.maxItems)
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
            var count, score, existing;

            if (_.isUndefined(options))
                options = {};

            // TODO: is there a better way to pass both non-models and models here?
            count = (member.count || member.get('count'));
            score = (member.score || member.get('score'));

            existing = this.collection.get(member.id);
            if (existing.get('count') != count)
                existing.set('count', count);

            if (existing.get('score') != score)
                existing.set('score', score);

            if (options.sort || true) {
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

        initialize: function(data){
            if (_.isUndefined(data))
                data = {};

            data.model = app.Group;
            
            app.OrderedElementsView.prototype.initialize.call(this, data);

            this.config = {
                realtime: data.realtime || false,
                pollUrl: data.pollUrl || null,
                pollTime: data.pollTime || 1000,
                tickTime: data.tickTime || 100
            };

            this.queue = new app.ScoredList();
            this.cursor = null;

            this.poll();

            window.setInterval(this.tick, this.config.tickTime);
        },

        tick: function(){
            if (!this.queue.length)
                return;

            var item = this.queue.pop();
            if (this.config.realtime){
                this.addMember(item);
            } else if (this.hasMember(item)) {
                this.updateMember(item, {
                    sort: false
                });
            }
        },

        poll: function(){
            var data;

            if (!this.config.realtime)
                return window.setTimeout(this.poll, this.config.pollTime);

            data = app.utils.getQueryParams();
            data.cursor = this.cursor || undefined;

            $.ajax({
                url: this.config.pollUrl,
                type: 'get',
                dataType: 'json',
                data: data,
                success: _.bind(function(groups){
                    var i, data, obj;

                    if (!groups.length)
                        return setTimeout(this.poll, this.config.pollTime * 5);

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

                    window.setTimeout(this.poll, this.config.pollTime);
                }, this),
                error: _.bind(function(){
                    // if an error happened lets give the server a bit of time before we poll again
                    window.setTimeout(this.poll, this.config.pollTime * 10);
                }, this)
            });
        }

    });

}(app, Backbone, jQuery, _));
