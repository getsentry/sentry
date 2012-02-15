"""
sentry.plugins.sentry_urls
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.db.models import Sum
from sentry.plugins import Plugin, register


@register
class UrlsPlugin(Plugin):
    """
    Adds additional support for showing information about urls including:

    * A panel which shows all urls a message was seen on.
    * A sidebar module which shows the urls most actively seen on.
    """

    title = 'URLs'

    def get_unique_urls(self, group):
        return group.messagefiltervalue_set.filter(key='url')\
                    .values_list('value')\
                    .annotate(times_seen=Sum('times_seen'))\
                    .values_list('value', 'times_seen', 'first_seen', 'last_seen')\
                    .order_by('-times_seen')

    def panels(self, request, group, panel_list, **kwargs):
        panel_list.append((self.get_title(), self.get_url(group)))
        return panel_list

    def view(self, request, group, **kwargs):
        return self.render('sentry/plugins/sentry_urls/index.html', {
            'group': group,
            'unique_urls': self.get_unique_urls(group),
        })

    def widget(self, request, group, **kwargs):
        return self.render('sentry/plugins/sentry_urls/widget.html', {
            'group': group,
            'unique_urls': list(self.get_unique_urls(group)[:10]),
        })
