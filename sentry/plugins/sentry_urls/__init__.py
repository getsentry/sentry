"""
sentry.plugins.sentry_urls
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.plugins import Plugin


class UrlsPlugin(Plugin):
    """
    Adds additional support for showing information about urls including:

    * A panel which shows all urls a message was seen on.
    * A sidebar module which shows the urls most actively seen on.
    """

    title = 'URLs'

    def panels(self, request, group, panel_list, **kwargs):
        panel_list.append((self.get_title(), self.get_url(group)))
        return panel_list

    def view(self, request, group, **kwargs):
        return self.render('sentry/plugins/sentry_urls/index.html')

    def widget(self, request, group, **kwargs):
        return self.render('sentry/plugins/sentry_urls/widget.html')
