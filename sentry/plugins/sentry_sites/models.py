"""
sentry.plugins.sentry_sites.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.shortcuts import render_to_response
from django.template.loader import render_to_string

from sentry.plugins import GroupActionProvider


class SiteGroupPanel(GroupActionProvider):
    """Adds additional support for showing information about sites including:

    * A panel which shows all sites a message was seen on.
    * A sidebar module which shows the sites most actively seen on.
    """

    title = 'Sites'

    def panels(self, request, panel_list, project, group):
        panel_list.append((self.title, self.__class__.get_url(project.pk, group.pk)))
        return panel_list

    def view(self, request, project, group):
        return render_to_response('sentry/plugins/sentry_sites/index.html', {
            'request': request,
            'project': project,
            'group': group,
        })

    def widget(self, request, project, group):
        return render_to_string('sentry/plugins/sentry_sites/widget.html', {
            'request': request,
            'project': project,
            'group': group,
        })
