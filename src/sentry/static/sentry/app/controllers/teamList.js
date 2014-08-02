(function(){
  'use strict';

  function refreshSparklines(){
    $('.chart').each(function(_, el){
      var $el = $(el);

      $.ajax({
        url: $el.attr('data-api-url'),
        type: 'get',
        dataType: 'json',
        data: {
          since: new Date().getTime() / 1000 - 3600 * 24,
          resolution: '1h'
        },
        success: function(data){
          for (var i = 0; i < data.length; i++) {
            // set timestamp to be in millis
            data[i][0] = data[i][0] * 1000;
          }

          $.plot($el, [{
              data: data,
              color: '#ebeff3',
              shadowSize: 0,
              lines: {
                lineWidth: 2,
                show: true,
                fill: true,
                color: '#f6f8fa'
              }
            }], {
              yaxis: {
                min: 0
              },
              grid: {
                show: false
              },
              hoverable: false,
              legend: {
                noColumns: 5
              },
              lines: {
                show: false
              }
            }
          );
        }
      });
    });
  }

  SentryApp.classy.controller({
    name: 'TeamListCtrl',

    init: function($window) {
      refreshSparklines();
      angular.element($window).bind('resize', refreshSparklines);
    }
  });
}());
