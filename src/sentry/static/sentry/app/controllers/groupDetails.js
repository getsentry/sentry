(function(){
  'use strict';

  SentryApp.controller('GroupDetailsCtrl', [
    '$scope', '$http', 'selectedProject', 'selectedTeam',
    function($scope, $http, selectedProject, selectedTeam) {
      var selectedGroup = window.SentryConfig.selectedGroup,
          urlPrefix = window.SentryConfig.urlPrefix;

      $scope.selectedGroup = selectedGroup;

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

      $('a[data-action="resolve"]').click(function(){
        $http.post('/api/0/groups/' + selectedGroup.id + '/', {
          status: (selectedGroup.status != 'resolved' ? 'resolved' : 'unresolved')
        }).success(function(data) {
          selectedGroup.status = data.status;
        });
      });

      $('a[data-action="bookmark"]').click(function(){
        $http.post('/api/0/groups/' + selectedGroup.id + '/', {
          isBookmarked: (selectedGroup.isBookmarked ? '0' : '1')
        }).success(function(data) {
          selectedGroup.isBookmarked = data.isBookmarked;
        });
      });

      $('a[data-action="remove"]').click(function(){
        if (confirm('Are you sure you wish to permanently remove data for this group?')) {
          $http.delete('/api/0/groups/' + selectedGroup.id + '/')
            .success(function(data) {
              window.location.href = '/' + selectedTeam.slug + '/' + selectedProject.slug + '/';
            });
        }
      });

      $('.tag-widget-list').each(function(){
          var $widget = $(this);
        $.ajax({
          url: $widget.data('url'),
          error: function() {
            $widget.find('.loading').remove();
            $widget.append($('<li class="error">Unable to load tag information</li>'));
          },
          success: function(data) {
            var total = data.total,
                eTagName = encodeURIComponent(data.name);

            $widget.find('.loading').remove();
            if (total === 0) {
              $widget.append($('<li>No data available.</li>'));
            } else {
              $.each(data.values, function(_, item){
                var tagValue = item[0],
                    timesSeen = item[1],
                    percent = parseInt(timesSeen / total * 100, 10),
                    url = urlPrefix + '/' + selectedTeam.slug + '/' + selectedProject.slug + '/';

                $('<li>' +
                  '<div class="progressbar">' +
                    '<div style="width:' + percent + '%">' + timesSeen + '</div>' +
                    '<a href="' + url + '?' + eTagName + '=' + encodeURIComponent(tagValue) + '">' +
                      tagValue +
                      '<span>' + percent + '%</span>' +
                    '</a>' +
                  '</div>' +
                '</li>').appendTo($widget);
              });
            }
          }
        });
      });
    }
  ]);
}());
