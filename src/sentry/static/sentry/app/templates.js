/*jshint multistr:true */

(function(){
  'use strict';

  var groupTemplate = '<div class="event-details event-cell"> \
  <div class="checkbox"> \
      <input type="checkbox"> \
  </div> \
  <h3><a href="<%= permalink %>"><%= title %></a></h3> \
  <div class="event-meta"> \
      <% if (timeSpent) { %><time><%= Math.round(timeSpent) %>ms</time> &middot;<% } %> \
      <span class="message"><%= message %></span> \
      &middot; <time><%= firstSeen %></time> \
  </div> \
</div> \
<div class="event-assignee event-cell"> \
  <div class="user-selector"> \
    <div class="btn-group"> \
      <a href="#" class="btn btn-sm btn-default dropdown-toggle"> \
        <img src="http://github.com/benvinegar.png" class="avatar"> \
        <span aria-hidden="true" class="icon-arrow-down"></span> \
      </a> \
      <div class="dropdown-menu"> \
        <input type="text" class="form-control input-sm" placeholder="Filter people"> \
        <ul> \
          <li><a href="#"><img src="http://github.com/dcramer.png" class="avatar"> David Cramer</a></li> \
          <li><a href="#"><img src="http://github.com/ckj.png" class="avatar"> Chris Jennings</a></li> \
          <li><a href="#"><img src="http://github.com/mattrobenolt.png" class="avatar"> Matt Robenolt</a></li> \
          <li><a href="#"><img src="http://github.com/byk.png" class="avatar"> Red Lobster</a></li> \
        </ul> \
      </div> \
    </div> \
  </div> \
</div> \
<div class="hidden-sm hidden-xs event-graph align-right event-cell"> \
    <span class="sparkline"></span> \
</div> \
<div class="hidden-xs event-occurrences align-center event-cell"> \
  <span><%= utils.formatNumber(count) %></span> \
</div> \
<div class="hidden-xs event-users align-right event-cell"> \
  <span>209</span> \
</div>';

  app.templates = {
    group: groupTemplate
  };
}());
