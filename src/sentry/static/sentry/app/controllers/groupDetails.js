(function(){
  'use strict';

  SentryApp.controller('GroupDetailsCtrl', [
    '$scope', '$http', 'selectedProject',
    function($scope, $http, selectedProject) {
      var selectedGroup = window.SentryConfig.selectedGroup;

      // TODO(dcramer): remove the window hack
      $http.post('/api/0/groups/' + selectedGroup.id + '/markseen/');

      $('#chart').height('150px');
      app.charts.createBasic('#chart');

      $('#public-status .action').click(function(){
          var $this = $(this);
          $.ajax({
              url: $this.attr('data-api-url'),
              type: 'post',
              success: function(group){
                  var selector = (group.isPublic ? 'true' : 'false');
                  var nselector = (group.isPublic ? 'false' : 'true');
                  $('#public-status span[data-public="' + selector + '"]').show();
                  $('#public-status span[data-public="' + nselector + '"]').hide();
              },
              error: function(){
                  window.alert('There was an error changing the public status');
              }
          });
      });

      $('.add-note-form textarea').focus(function () {
          $(this).addClass('expanded');
      });

      $('.add-note-form textarea').keypress(function (e) {
          if (e.which == 13 && !e.shiftKey) {
            $('.add-note-form').submit();
            return false;
          }
      });
    }
  ]);
}());
