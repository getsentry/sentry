from django.shortcuts import render_to_response
from django.template.loader import render_to_string

from sentry.plugins import GroupActionProvider

class SiteGroupPanel(GroupActionProvider):
    """Adds additional support for showing information about sites including:
    
    * A panel which shows all sites a message was seen on.
    * A sidebar module which shows the sites most actively seen on.
    """
    
    title = 'Sites'

    def panels(self, request, panel_list, group):
        panel_list.append((self.title, self.__class__.get_url(group.pk)))
        return panel_list

    def view(self, request, group):
        return render_to_response('sentry/plugins/sentry_sites/index.html', locals())
    
    def widget(self, request, group):
        return render_to_string('sentry/plugins/sentry_sites/widget.html', locals())