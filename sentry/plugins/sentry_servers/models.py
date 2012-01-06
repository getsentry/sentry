"""
sentry.plugins.sentry_servers.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.plugins import Plugin


class ServerGroupPanel(Plugin):
    """Adds additional support for showing information about servers including:

    * A panel which shows all servers a message was seen on.
    * A sidebar module which shows the servers most actively seen on.
    """

    title = 'Servers'

    def panels(self, group, panel_list, **kwargs):
        panel_list.append((self.title, self.get_url(group)))
        return panel_list

    def view(self, group, **kwargs):
        return self.render('sentry/plugins/sentry_servers/index.html')

    def widget(self, group, **kwargs):
        return self.render('sentry/plugins/sentry_servers/widget.html')
