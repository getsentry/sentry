(function(){
  'use strict';

  $('input[data-toggle="datepicker"]').datepicker();

  $('.tip').tooltip({
      html: true,
      container: 'body'
  });

  $('.trigger-popover').popover({
      html: true,
      container: 'body'
  });

  $('.nav-tabs .active a').tab('show');

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
}());
