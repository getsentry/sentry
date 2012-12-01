/*!
 * Color animation jQuery-plugin
 * http://www.bitstorm.org/jquery/color-animation/
 * Based on code copyright 2007 John Resig
 * Copyright 2010 Edwin Martin <edwin@bitstorm.org>
 * Released under the MIT and GPL licenses.
 */

(function(d){function h(a,b,c){return"#"+g(a[0]+c*(b[0]-a[0]))+g(a[1]+c*(b[1]-a[1]))+g(a[2]+c*(b[2]-a[2]))}function g(a){a=parseInt(a).toString(16);return a.length==1?"0"+a:a}function e(a){var b,c;if(b=/#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/.exec(a))c=[parseInt(b[1],16),parseInt(b[2],16),parseInt(b[3],16)];else if(b=/#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])/.exec(a))c=[parseInt(b[1],16)*17,parseInt(b[2],16)*17,parseInt(b[3],16)*17];else if(b=/rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)/.exec(a))c=
[parseInt(b[1]),parseInt(b[2]),parseInt(b[3])];return c}var i=["color","backgroundColor","borderBottomColor","borderLeftColor","borderRightColor","borderTopColor","outlineColor"];d.each(i,function(a,b){d.fx.step[b]=function(c){if(!c.init){c.a=e(d(c.elem).css(b));c.end=e(c.end);c.init=true}c.elem.style[b]=h(c.a,c.end,c.pos)}});d.fx.step.borderColor=function(a){if(!a.init)a.end=e(a.end);var b=i.slice(2,6);d.each(b,function(c,f){a.init||(a[f]={a:e(d(a.elem).css(f))});a.elem.style[f]=h(a[f].a,a.end,a.pos)});
a.init=true}})(jQuery);