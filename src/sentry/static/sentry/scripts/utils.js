(function(app, jQuery, _){
    "use strict";

    var $ = jQuery;
    var time_formats = [
        [60, 'just now', 'just now'], // 60
        [120, '1 minute ago', '1 minute from now'], // 60*2
        [3600, 'minutes', 60], // 60*60, 60
        [7200, '1 hour ago', '1 hour from now'], // 60*60*2
        [86400, 'hours', 3600], // 60*60*24, 60*60
        [172800, 'yesterday', 'tomorrow'], // 60*60*24*2
        [604800, 'days', 86400], // 60*60*24*7, 60*60*24
        [1209600, 'last week', 'next week'], // 60*60*24*7*4*2
        [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
        [4838400, 'last month', 'next month'], // 60*60*24*7*4*2
        [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
        [58060800, 'last year', 'next year'], // 60*60*24*7*4*12*2
        [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
        [5806080000, 'last century', 'next century'], // 60*60*24*7*4*12*100*2
        [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
    ];
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

        prettyDate: function(date_str){
            // we need to zero out at CST
            var time = Date.parse(date_str);
            var now = new Date();
            var now_utc = Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                now.getUTCHours(),
                now.getUTCMinutes(),
                now.getUTCSeconds()
            );
            var token = 'ago';
            var seconds = (now_utc - time) / 1000;
            var list_choice = 1;

            if (seconds < 0) {
                seconds = Math.abs(seconds);
                token = 'from now';
                list_choice = 2;
            }

            for (var i=0, format; (format = time_formats[i]); i++){
                if (seconds < format[0]) {
                    if (typeof format[2] == 'string')
                        return format[list_choice];
                    else
                        return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
                }
            }
            return time;
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
                var title = $el.attr('title');
                if (title) {
                    var date = app.utils.prettyDate(title);
                    if (date) {
                        $el.text(date);
                    }
                }
            });
        }, 5000);
    });

    $.fn.select2.defaults.escapeMarkup = function(s) { return s; };
}(app, jQuery, _));

/**
 * Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
 * © 2011 Colin Snover <http://zetafleet.com>
 * Released under MIT license.
 */
(function (Date, undefined) {
    "use strict";

    var origParse = Date.parse, numericKeys = [ 1, 4, 5, 6, 7, 10, 11 ];
    Date.parse = function (date) {
        var timestamp, struct, minutesOffset = 0;

        // ES5 §15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
        // before falling back to any implementation-specific date parsing, so that’s what we do, even if native
        // implementations could be faster
        //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 ±    10 tzHH    11 tzmm
        if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
            // avoid NaN timestamps caused by “undefined” values being passed to Date.UTC
            for (var i = 0, k; (k = numericKeys[i]); ++i) {
                struct[k] = +struct[k] || 0;
            }

            // allow undefined days and months
            struct[2] = (+struct[2] || 1) - 1;
            struct[3] = +struct[3] || 1;

            if (struct[8] !== 'Z' && struct[9] !== undefined) {
                minutesOffset = struct[10] * 60 + struct[11];

                if (struct[9] === '+') {
                    minutesOffset = 0 - minutesOffset;
                }
            }

            timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
        }
        else {
            timestamp = origParse ? origParse(date) : NaN;
        }

        return timestamp;
    };
}(Date));
