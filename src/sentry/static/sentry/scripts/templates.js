(function(app){
    "use strict";

    app.templates = {
        group: '' + 
            '<div class="count" data-count="<%= app.utils.formatNumber(count) %>"><span><%= app.utils.formatNumber(count) %></span></div>' + 
            '<div class="details">' + 
                '<h3><a href="<%= permalink %>"><%= title %></a></h3>' + 
                '<p class="message">' + 
                    '<span class="tag tag-logger"><%= logger %></span>' + 
                    '<% _.each(versions, function(version){ %> ' + 
                        '<span class="tag tag-version"><%= version %></span>' + 
                    '<% }) %>' + 
                    '<% _.each(tags, function(tag){ %> ' + 
                        '<span class="tag"><%= tag %></span>' + 
                    '<% }) %>' + 
                    '<%= message %>' + 
                '</p>' + 
                '<div class="meta">' + 
                    '<span class="last-seen pretty-date" title="<%= lastSeen %>"><%= app.utils.prettyDate(lastSeen) %></span>' + 
                    '<% if (timeSpent) { %>' + 
                        '<span class="time-spent"><%= Math.round(timeSpent) %>ms</span>' + 
                    '<% } %>' + 
                    '<span class="tag tag-project"><%= project.name %></span>' + 
                '</div>' + 
                '<span class="sparkline"></span>' + 
                '<ul class="actions">' + 
                    '<% if (canResolve) { %>' + 
                        '<li>' +
                            '<% if (!isResolved) { %>' + 
                                '<a href="#" data-action="resolve" title="Mark as Resolved">&#10003;</a>' + 
                            '<% } else { %>' + 
                                '<a href="#" class="checked" title="Already Resolved">&#10003;</a>' + 
                            '<% } %>' + 
                        '</li>' + 
                        '<li>' + 
                            '<a href="#" data-action="bookmark" class="bookmark<% if (isBookmarked) { %> checked<% } %>" title="Bookmark">&#9733;</a>' + 
                        '</li>' + 
                    '<% } %>' + 
                '</ul>' + 
            '</div>' + 
        '</script>'
    };
}(app));