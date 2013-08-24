(function(app){
    "use strict";

    app.templates = {
        group: '' +
            '<div class="count" data-count="<%= app.utils.formatNumber(count) %>">' +
                '<span title="<%= count %>"><%= app.utils.formatNumber(count) %></span>' +
            '</div>' +
            '<div class="details">' +
                '<h3><a href="<%= permalink %>"><%= title %></a></h3>' +
                '<p class="message">' +
                    '<%= message %>' +
                '</p>' +
                '<div class="meta">' +
                    '<span class="last-seen pretty-date" title="<%= lastSeen %>"><%= app.utils.prettyDate(lastSeen) %></span>' +
                    '<% if (timeSpent) { %>' +
                        '<span class="time-spent"><%= Math.round(timeSpent) %>ms</span>' +
                    '<% } %>' +
                    '<span class="tag tag-project"><%= project.name %></span>' +
                    '<span class="tag tag-logger">' +
                        '<a href="<%= loggerUrl %>"><%= logger %></a>' +
                    '</span>' +
                    '<% _.each(versions, function(version){ %> ' +
                        '<span class="tag tag-version"><%= version %></span>' +
                    '<% }) %>' +
                    '<% _.each(tags, function(tag){ %> ' +
                        '<span class="tag"><%= tag %></span>' +
                    '<% }) %>' +
                '</div>' +
                '<span class="sparkline"></span>' +
                '<ul class="actions">' +
                    '<% if (canResolve) { %>' +
                        '<li>' +
                            '<a href="#" data-action="resolve">' +
                                '<i aria-hidden="true" class="icon-checkmark"></i>' +
                            '</a>' +
                        '</li>' +
                        '<li>' +
                            '<a href="#" data-action="bookmark" class="bookmark<% if (isBookmarked) { %> checked<% } %>" title="Bookmark">' +
                                '<i aria-hidden="true" class="icon-star"></i>' +
                            '</a>' +
                        '</li>' +
                    '<% } %>' +
                '</ul>' +
            '</div>'
    };
}(app));
