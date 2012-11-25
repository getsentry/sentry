window.app = app = window.app || {}
app.templates = {}

app.templates.group = '
        <div class="count" data-count="<%= app.formatNumber(count) %>"><span><%= app.formatNumber(count) %></span></div>
        <div class="details">
            <h3><a href="<%= permalink %>"><%= title %></a></h3>
            <p class="message">
                <%= message %>
            </p>
            <div class="meta">
                <span class="last-seen pretty-date" title="<%= lastSeen %>"><%= app.prettyDate(lastSeen) %></span>
                <% if (timeSpent) { %>
                    <span class="time-spent"><%= app.utils.round(timeSpent) %>ms</span>
                <% } %>
                <span class="tag tag-project"><%= project.name %></span>
                <span class="tag tag-logger"><%= logger %></span>
                <% _.each(versions, function(version){ %> 
                    <span class="tag tag-version"><%= version %></span>
                <% }) %>
                <% _.each(tags, function(tag){ %> 
                    <span class="tag"><%= tag %></span>
                <% }) %>
            </div>
            <span class="sparkline"></span>
            <ul class="actions">
                <% if (canResolve) { %>
                    <li>
                        <% if (!isResolved) { %>
                            <a href="#" data-action="resolve" title="Mark as Resolved"><i aria-hidden="true" class="icon-checkmark"></i></a>
                        <% } else { %>
                            <a href="#" class="checked" title="Already Resolved"><i aria-hidden="true" class="icon-checkmark"></i></a>
                        <% } %>
                    </li>
                    <li>
                        <a href="#" data-action="bookmark" class="bookmark<% if (isBookmarked) { %> bookmarked<% } %>" title="Bookmark"><i aria-hidden="true" class="icon-star"></i></a>
                    </li>
                <% } %>
            </ul>
        </div>
    </script>'