(function(app, jQuery){
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

        createSparkline: function(el, bits){
            // TODO: maxval could default to # of hours since first_seen / times_seen
            var $el = $(el),
                existing = $el.find('> span'),
                maxval = 10,
                i, bit, pct, child;

            for (i=0; i<bits.length; i++) {
                if (bits[i] > maxval) {
                    maxval = bits[i];
                }
            }

            // TODO: we should only remove nodes that are no longer valid
            for (i=0; i<bits.length; i++) {
                bit = bits[i];
                pct = parseInt(bit / maxval * 100, 10) + '%';
                child = existing[i];
                if (child === undefined) {
                    $('<span><span style="height:' + pct + '" title="' + bit + '">' + bit + '</span></span>').appendTo($el);
                } else {
                    $(child).find('span').css('height', pct).text(bit);
                }
            }
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
                    if (('' + o.length) > 2 || !p)
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
        }

    };

}(app, jQuery));

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