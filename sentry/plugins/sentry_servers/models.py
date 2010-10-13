from django.shortcuts import render_to_response
from django.template.loader import render_to_string

from sentry.plugins import GroupActionProvider

class ServerGroupPanel(GroupActionProvider):
    """Adds additional support for showing information about servers including:
    
    * A panel which shows all servers a message was seen on.
    * A sidebar module which shows the servers most actively seen on.
    """
    
    title = 'Servers'

    def panels(self, request, panel_list, group):
        panel_list.append((self.title, self.__class__.get_url(group.pk)))
        return panel_list

    def view(self, request, group):
        return render_to_response('sentry/plugins/sentry_servers/index.html', locals())
    
    def widget(self, request, group):
        return render_to_string('sentry/plugins/sentry_servers/widget.html', locals())