(function(){
  'use strict';

  function formatHours(val) {
    val = parseInt(val, 10);
    if (val === 0) {
      return 'Disabled';
    } else if (val > 23 && val % 24 === 0) {
      val = (val / 24);
      return val + ' day' + (val != 1 ? 's' : '');
    }
    return val + ' hour' + (val != 1 ? 's' : '');
  }

  SentryApp.classy.controller({
    name: 'ManageProjectCtrl',

    inject: ['$scope'],

    init: function() {
      app.utils.makeSearchableUsersInput('form input[name=owner]');

      $("input[type=range]").each(function loop(n, el){
        var $el = $(el),
            min = parseInt($el.attr('min'), 10),
            max = parseInt($el.attr('max'), 10),
            step = parseInt($el.attr('step'), 10),
            values = [],
            $value = $('<span class="value"></span>');

        var i = min;
        while (i <= max) {
          values.push(i);
          if (i < 12) {
            i += 1;
          } else if (i < 24) {
            i += 3;
          } else if (i < 36) {
            i += 6;
          } else if (i < 48) {
            i += 12;
          } else {
            i += 24;
          }
        }

        $el.on("slider:ready", function sliderready(event, data) {
          $value.appendTo(data.el);
          $value.html(formatHours(data.value));
        }).on("slider:changed", function sliderchanged(event, data) {
          $value.html(formatHours(data.value));
        }).simpleSlider({
          range: [min, max],
          step: step,
          allowedValues: values,
          snap: true
        });
      });
    }
  });
}());
