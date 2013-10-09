(function(app, jQuery, _, moment){
    "use strict";

    var $ = jQuery;
    var number_formats = [
        [1000000000, 'b'],
        [1000000, 'm'],
        [1000, 'k']
    ];

    app.utils = {
        getQueryParams: function() {

            var vars = {},
                href = window.location.href,
                hashes, hash;

            if (href.indexOf('?') == -1)
                return vars;

            hashes = href.slice(href.indexOf('?') + 1, (href.indexOf('#') != -1 ? href.indexOf('#') : href.length)).split('&');
            $.each(hashes, function(_, chunk){
                hash = chunk.split('=');
                if (!hash[0] && !hash[1])
                    return;

                vars[hash[0]] = (hash[1] ? decodeURIComponent(hash[1]).replace(/\+/, ' ') : '');
            });

            return vars;
        },

        floatFormat: function(number, places){
            var multi = Math.pow(10, places);
            return parseInt(number * multi, 10) / multi;
        },

        formatNumber: function(number){
            var b, x, y, o, p;

            number = parseInt(number, 10);

            for (var i=0; (b=number_formats[i]); i++){
                x = b[0];
                y = b[1];
                o = Math.floor(number / x);
                p = number % x;
                if (o > 0) {
                    if (o / 10 > 1 || !p)
                        return '' + o + y;
                    return '' + this.floatFormat(number / x, 1) + y;
                }
            }
            return '' + number;
        },

        slugify: function(str) {
            str = str.replace(/^\s+|\s+$/g, ''); // trim
            str = str.toLowerCase();

            // remove accents, swap ñ for n, etc
            var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
            var to   = "aaaaeeeeiiiioooouuuunc------";
            for (var i=0, l=from.length ; i<l ; i++) {
                str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
            }

            str = str.replace(/[^a-z0-9\s\-]/g, '') // remove invalid chars
                .replace(/\s+/g, '-') // collapse whitespace and replace by -
                .replace(/-+/g, '-'); // collapse dashes

            return str;
        },

        varToggle: function(link, $elm) {
            var $link = $(link);

            // assume its collapsed by default
            if (!$link.attr('data-expand-label'))
                $link.attr('data-expand-label', $link.html());

            $elm.toggle();
            if ($elm.is(':visible'))
                $link.html($link.attr('data-collapse-label'));
            else
                $link.html($link.attr('data-expand-label'));
        },

        getSearchUsersUrl: function(){
            return app.config.urlPrefix + '/api/' + app.config.teamId + '/users/search/';
        },

        getSearchProjectsUrl: function(){
            return app.config.urlPrefix + '/api/' + app.config.teamId + '/projects/search/';
        },

        getSearchTagsUrl: function(){
            return app.config.urlPrefix + '/api/' + app.config.teamId + '/' + app.config.projectId + '/tags/search/';
        },

        makeSearchableInput: function(el, url, callback) {
            $(el).select2({
                allowClear: true,
                width: 'element',
                initSelection: function (el, callback) {
                    var $el = $(el);
                    callback({id: $el.val(), text: $el.val()});
                },
                ajax: {
                    url: url,
                    dataType: 'json',
                    data: function (term, page) {
                        return {
                            query: term,
                            limit: 10
                        };
                    },
                    results: function(data, page) {
                        var results = callback(data);
                        return {results: callback(data)};
                    }
                }
            });
        },

        escape: function(str) {
            return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        },

        makeSearchableUsersInput: function(el) {
            this.makeSearchableInput(el, this.getSearchUsersUrl(), _.bind(function(data){
                var results = [];
                $(data.results).each(_.bind(function(_, val){
                    var label;
                    if (val.first_name) {
                        label = this.escape(val.first_name) + ' &mdash; ' + this.escape(val.username);
                    } else {
                        label = this.escape(val.username);
                    }
                    label += '<br>' + this.escape(val.email);
                    results.push({
                        id: val.username,
                        text: label
                    });
                }, this));

                if ($(results).filter(function(){
                    return this.id.localeCompare(data.query) === 0;
                }).length === 0) {
                    results.push({
                        id: this.escape(data.query),
                        text: this.escape(data.query)
                    });
                }

                return results;
            }, this));
        },

        makeSearchableProjectsInput: function(el) {
            this.makeSearchableInput(el, this.getSearchProjectsUrl(), function(data){
                var results = [];
                $(data.results).each(function(_, val){
                    results.push({
                        id: val.slug,
                        text: val.name + '<br>' + val.slug
                    });
                });
                return results;
            });
        },

        makeSearchableTagsInput: function(el, options) {
            var $el = $(el);
            $el.select2({
                multiple: true,
                tokenSeperators: [","],
                minimumInputLength: 3,
                allowClear: true,
                width: 'element',
                initSelection: function (el, callback) {
                    var $el = $(el);
                    var values = $el.val().split(',');
                    var results = [];
                    $.each(values, function(_, val) {
                        results.push({id: val, text: val});
                    });
                    callback(results);
                },
                ajax: {
                    url: this.getSearchTagsUrl(),
                    dataType: 'json',
                    data: function (term, page) {
                        return {
                            query: term,
                            quietMillis: 300,
                            name: $el.data('tag'),
                            limit: 10
                        };
                    },
                    results: function(data, page) {
                        var results = [];

                        $(data.results).each(function(_, val){
                            results.push({
                                id: val,
                                text: val
                            });
                        });

                        if ($(results).filter(function(){
                            return this.id.localeCompare(data.query) === 0;
                        }).length === 0) {
                            results.push({id:data.query, text:data.query});
                        }

                        return {results: results};
                    }
                }
            });
        }

    };

    $(function(){
        // Change all select boxes to select2 elements.
        $('.body select').each(function(){
            var $this = $(this),
                options = {
                    width: 'element',
                    allowClear: false
                };

            if ($this.attr('data-allowClear')) {
                options.allowClear = $this.attr('data-allowClear');
            }

            $this.select2(options);
        });

        // Update date strings periodically
        setInterval(function() {
            $('.pretty-date').each(function(_, el){
                var $el = $(el);
                var dt = $el.data('datetime');
                if (dt) {
                    var date = moment(dt);
                    if (date) {
                        $el.text(date.fromNow());
                        $el.attr('title', date.format('llll'));
                    }
                }
            });
        }, 5000);
    });

    $.fn.select2.defaults.escapeMarkup = function(s) { return s; };
}(app, jQuery, _, moment));
