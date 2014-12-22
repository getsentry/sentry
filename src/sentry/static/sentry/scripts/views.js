(function(window, app, Backbone, jQuery, _, moment){
    "use strict";

    var $ = jQuery;

    app.GroupView = Backbone.View.extend({
        tagName: 'li',
        className: 'group',
        template: _.template(app.templates.group),

        initialize: function(){
            Backbone.View.prototype.initialize.apply(this, arguments);

            _.bindAll(this, 'updateCount', 'updateAllAnnotations', 'updateAnnotation', 'updateLastSeen',
                'updateResolved', 'updateHasSeen', 'renderSparkline', 'updateBookmarked',
                'render');

            this.model.on({
                'change:count': this.updateCount,
                'change:annotations': this.updateAllAnnotations,
                'change:lastSeen': this.updateLastSeen,
                'change:isBookmarked': this.updateBookmarked,
                'change:isResolved': this.updateResolved,
                'change:hasSeen': this.updateHasSeen,
                'change:historicalData': this.renderSparkline
            }, this);
        },

        render: function(){
            var data = this.model.toJSON();
            data.projectUrl = app.config.urlPrefix + '/' + app.config.organizationId +
                '/' + data.project.slug + '/';
            data.loggerUrl = data.projectUrl + '?logger=' + data.logger;

            this.$el.html(this.template(data));
            this.$el.attr('data-id', this.model.id);
            this.$el.addClass(this.getLevelClassName());
            this.$el.find('a[data-action=resolve]').click(_.bind(function(e){
                e.preventDefault();
                if (this.model.get('isResolved')) {
                    this.unresolve();
                } else {
                    this.resolve();
                }
            }, this));
            this.$el.find('a[data-action=bookmark]').click(_.bind(function(e){
                e.preventDefault();
                this.bookmark();
            }, this));
            this.updateLastSeen();
            this.renderSparkline();
            this.updateResolved();
            this.updateHasSeen();
            this.updateBookmarked();
        },

        updateBookmarked: function(){
            if (this.model.get('isBookmarked')) {
                this.$el.find('a[data-action=bookmark]').addClass('checked');
            } else {
                this.$el.find('a[data-action=bookmark]').removeClass('checked');
            }
        },

        updateResolved: function(){
            if (this.model.get('isResolved')) {
                this.$el.addClass('resolved');
            } else {
                this.$el.removeClass('resolved');
            }
        },

        updateHasSeen: function(){
            if (this.model.get('hasSeen')) {
                this.$el.addClass('seen');
            } else {
                this.$el.removeClass('seen');
            }
        },

        renderSparkline: function(obj){
            var data = this.model.get('historicalData');
            if (!data || !data.length)
                return;

            this.$el.addClass('with-sparkline');

            app.charts.createSparkline(this.$el.find('.sparkline'), data);
        },

        resolve: function(){
            $.ajax({
                url: this.getResolveUrl(),
                type: 'post',
                dataType: 'json',
                success: _.bind(function(response) {
                    this.model.set('version', response.version + 5000);
                    this.model.set('isResolved', true);
                }, this)
            });
        },

        unresolve: function(){
            $.ajax({
                url: this.getUnresolveUrl(),
                type: 'post',
                dataType: 'json',
                success: _.bind(function(response) {
                    this.model.set('version', response.version + 5000);
                    this.model.set('isResolved', false);
                }, this)
            });
        },

        getResolveUrl: function(){
            return app.config.urlPrefix + '/api/' + app.config.organizationId + '/' +
                    app.config.projectId + '/group/' + this.model.get('id') +
                    '/set/resolved/';
        },

        getUnresolveUrl: function(){
            return app.config.urlPrefix + '/api/' + app.config.organizationId + '/' +
                    app.config.projectId + '/group/' + this.model.get('id') +
                    '/set/unresolved/';
        },

        getBookmarkUrl: function(){
            return app.config.urlPrefix + '/api/' + app.config.organizationId + '/' + app.config.projectId + '/bookmark/';
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
                    this.model.set('version', response.version);
                    this.model.set('isBookmarked', response.isBookmarked);
                }, this)
            });
        },

        getLevelClassName: function(){
            return 'level-' + this.model.get('levelName');
        },

        updateLastSeen: function(){
            var dt = moment(this.model.get('lastSeen'));
            this.$el.find('.last-seen')
                .text(dt.fromNow())
                .data('datetime', this.model.get('lastSeen'))
                .attr('title', dt.format('llll'));
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
        },

        updateAnnotation: function(annotation){
            var value = annotation.count;
            if (value === null)
                return;
            var new_count = app.utils.formatNumber(value);
            var counter = this.$el.find('.annotation[data-tag="' + annotation.label + '"]');
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
        },

        updateAllAnnotations: function(){
            var self = this;
            $.each(this.model.get('annotations'), function(index, annotation){
                self.updateAnnotation(annotation);
            });
        }

    });

    app.OrderedElementsView = Backbone.View.extend({

        loadingMessage: '<p>Loading...</p>',
        model: app.models.Group,

        defaults: {
            emptyMessage: '<p>There is no data to show.</p>',
            maxItems: 50,
            view: Backbone.View
        },

        initialize: function(data){
            if (_.isUndefined(data))
                data = {};

            var members = data.members;

            Backbone.View.prototype.initialize.apply(this, arguments);

            this.options = $.extend({}, this.defaults, this.options, data);

            this.$wrapper = $('#' + this.id);
            this.$parent = $('<ul></ul>');
            this.$empty = $('<li class="empty"></li>');
            this.$wrapper.html(this.$parent);

            if (this.options.className)
                this.$parent.addClass(this.options.className);

            _.bindAll(this, 'renderMemberInContainer', 'unrenderMember', 'reSortMembers');

            this.collection = new app.ScoredList([], {
                model: data.model
            });
            this.collection.on('add', this.renderMemberInContainer, this);
            this.collection.on('remove', this.unrenderMember, this);
            this.collection.on('reset', this.reSortMembers, this);

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
                this.$empty.html(this.options.emptyMessage);
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
            var existing = this.collection.get(member.id);

            function getAttr(x) {
                if (typeof member.get === 'function') {
                    return member.get(x);
                } else {
                    return member[x];
                }
            }
            if (!existing) {
                if (this.collection.length >= this.options.maxItems) {
                    // bail early if the score is too low
                    if (getAttr('score') < this.collection.last().get('score'))
                        return;

                    // make sure we limit the number shown
                    while (this.collection.length >= this.options.maxItems)
                        this.collection.pop();
                }
            } else if (existing.get('version') >= (getAttr('version') || 0)) {
                return;
            }
            this.collection.add(member, {merge: true});
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
            if (existing.get('version') >= member.get('version'))
                return;

            this.collection.add(member, {
                merge: true,
                sort: options.sort !== false ? true : false
            });

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
                $el.css('background-color', '#eee').animate({backgroundColor: '#fff'}, 300);
        },

        renderMember: function(member){
            var view = new this.options.view({
                model: member,
                id: this.id + member.id
            });
            view.render();
            return view.$el;
        },

        unrenderMember: function(member){
            this.$parent.find('#' + this.id + member.id).remove();
            if (!this.$parent.find('li').length)
                this.setEmpty();
        }

    });


    app.GroupListView = app.OrderedElementsView.extend({

        defaults: {
            emptyMessage: '<p>There is no data to show.</p>',
            maxItems: 50,
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
            data.view = app.GroupView;

            app.OrderedElementsView.prototype.initialize.call(this, data);

            this.options = $.extend({}, this.defaults, this.options, data);

            this.queue = new app.ScoredList([], {
                model: data.model
            });

            this.cursor = null;

            _.bindAll(this, 'poll', 'pollSuccess', 'pollFailure', 'tick');

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

        pollSuccess: function(groups, _, jqXHR){
            if (!groups.length)
                return window.setTimeout(this.poll, this.options.pollTime * 5);

            var links = app.utils.parseLinkHeader(jqXHR.getResponseHeader('Link'));

            this.options.pollUrl = links.previous;

            this.queue.add(groups, {merge: true});

            window.setTimeout(this.poll, this.options.pollTime);
        },

        pollFailure: function(jqXHR, textStatus, errorThrown){
            // if an error happened lets give the server a bit of time before we poll again
            window.setTimeout(this.poll, this.options.pollTime * 10);
        },

        poll: function(){
            var data;

            if (!this.options.realtime || !this.options.pollUrl)
                return window.setTimeout(this.poll, this.options.pollTime);

            data = app.utils.getQueryParams();
            data.cursor = this.cursor || undefined;

            $.ajax({
                url: this.options.pollUrl,
                type: 'GET',
                dataType: 'json',
                data: data,
                success: this.pollSuccess,
                error: this.pollFailure
            });
        }

    });

}(window, app, Backbone, jQuery, _, moment));
