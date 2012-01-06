"""
sentry.plugins.sentry_urls.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.plugins import Plugin


class ServerUrlsPanel(Plugin):
    """Adds additional support for showing information about urls including:

    * A panel which shows all urls a message was seen on.
    * A sidebar module which shows the urls most actively seen on.
    """

    title = 'URLs'

    def panels(self, group, panel_list, **kwargs):
        panel_list.append((self.title, self.get_url(group)))
        return panel_list

    def view(self, group, **kwargs):
        return self.render('sentry/plugins/sentry_urls/index.html')

    def widget(self, group, **kwargs):
        return self.render('sentry/plugins/sentry_urls/widget.html')
