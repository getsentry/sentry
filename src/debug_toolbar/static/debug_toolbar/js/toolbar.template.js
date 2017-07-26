(function ($) {
    var uarr = String.fromCharCode(0x25b6),
        darr = String.fromCharCode(0x25bc);

    $('a.djTemplateShowContext').on('click', function() {
        var arrow = $(this).children('.toggleArrow');
        arrow.html(arrow.html() == uarr ? darr : uarr);
        $(this).parent().next().toggle();
        return false;
    });
})(djdt.jQuery);
