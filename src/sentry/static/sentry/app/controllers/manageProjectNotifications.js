(function(){
  'use strict';

  function formatThreshold(value) {
    if (!value) {
      return 'Disabled';
    }
    return value + '%';
  }

  SentryApp.classy.controller({
    name: 'ManageProjectNotificationsCtrl',

    inject: ['$scope'],

    init: function() {
      $("input[type=range]").each(function loop(n, el){
          var $el = $(el),
              min = parseInt($el.attr('min'), 10),
              max = parseInt($el.attr('max'), 10),
              step = parseInt($el.attr('step'), 10),
              $value = $('<span class="value"></span>');

          $el.on("slider:ready", function sliderready(event, data) {
              $value.appendTo(data.el);
              $value.html(formatThreshold(data.value));
          }).on("slider:changed", function sliderchanged(event, data) {
              $value.html(formatThreshold(data.value));
          }).simpleSlider({
              range: [min, max],
              step: step,
              snap: true
          });
      });
    }
  });
}());
