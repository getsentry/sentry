/**!
 * @preserve Color animation 20120928
 * http://www.bitstorm.org/jquery/color-animation/
 * Copyright 2011, 2012 Edwin Martin <edwin@bitstorm.org>
 * Released under the MIT and GPL licenses.
 */

(function($) {
    /**
     * Check whether the browser supports RGBA color mode.
     *
     * Author Mehdi Kabab <http://pioupioum.fr>
     * @return {boolean} True if the browser support RGBA. False otherwise.
     */
    function isRGBACapable() {
        var $script = $('script:first'),
                color = $script.css('color'),
                result = false;
        if (/^rgba/.test(color)) {
            result = true;
        } else {
            try {
                result = ( color != $script.css('color', 'rgba(0, 0, 0, 0.5)').css('color') );
                $script.css('color', color);
            } catch (e) {
            }
        }

        return result;
    }

    $.extend(true, $, {
        support: {
            'rgba': isRGBACapable()
        }
    });

    var properties = ['color', 'backgroundColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'borderTopColor', 'outlineColor'];
    $.each(properties, function(i, property) {
        $.Tween.propHooks[ property ] = {
            get: function(tween) {
                return $(tween.elem).css(property);
            },
            set: function(tween) {
                var style = tween.elem.style;
                var p_begin = parseColor($(tween.elem).css(property));
                var p_end = parseColor(tween.end);
                tween.run = function(progress) {
                    style[property] = calculateColor(p_begin, p_end, progress);
                }
            }
        }
    });

    // borderColor doesn't fit in standard fx.step above.
    $.Tween.propHooks.borderColor = {
        set: function(tween) {
            var style = tween.elem.style;
            var p_begin = [];
            var borders = properties.slice(2, 6); // All four border properties
            $.each(borders, function(i, property) {
                p_begin[property] = parseColor($(tween.elem).css(property));
            });
            var p_end = parseColor(tween.end);
            tween.run = function(progress) {
                $.each(borders, function(i, property) {
                    style[property] = calculateColor(p_begin[property], p_end, progress);
                });
            }
        }
    }

    // Calculate an in-between color. Returns "#aabbcc"-like string.
    function calculateColor(begin, end, pos) {
        var color = 'rgb' + ($.support['rgba'] ? 'a' : '') + '('
                + parseInt((begin[0] + pos * (end[0] - begin[0])), 10) + ','
                + parseInt((begin[1] + pos * (end[1] - begin[1])), 10) + ','
                + parseInt((begin[2] + pos * (end[2] - begin[2])), 10);
        if ($.support['rgba']) {
            color += ',' + (begin && end ? parseFloat(begin[3] + pos * (end[3] - begin[3])) : 1);
        }
        color += ')';
        return color;
    }

    // Parse an CSS-syntax color. Outputs an array [r, g, b]
    function parseColor(color) {
        var match, triplet;

        // Match #aabbcc
        if (match = /#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/.exec(color)) {
            triplet = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16), 1];

            // Match #abc
        } else if (match = /#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])/.exec(color)) {
            triplet = [parseInt(match[1], 16) * 17, parseInt(match[2], 16) * 17, parseInt(match[3], 16) * 17, 1];

            // Match rgb(n, n, n)
        } else if (match = /rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)/.exec(color)) {
            triplet = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), 1];

        } else if (match = /rgba\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9\.]*)\s*\)/.exec(color)) {
            triplet = [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10),parseFloat(match[4])];

            // No browser returns rgb(n%, n%, n%), so little reason to support this format.
        }
        return triplet;
    }
})(jQuery);