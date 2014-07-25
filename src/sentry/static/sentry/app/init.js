(function(){
  'use strict';

  $('.clippy').clippy({
      clippy_path: '../clippy.swf',
      keep_text: true
  });

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

  $('.project-selector').on('change', function(e){
      var $el = $(e.target).get(0);
      var $opt = $($el.options[$el.selectedIndex]);
      window.location.href = $opt.attr('data-url');
      return false;
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
}());
