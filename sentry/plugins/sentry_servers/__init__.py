"""
sentry.plugins.sentry_servers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import sentry

from django.db.models import Sum
from django.utils.translation import ugettext_lazy as _

from sentry.plugins import Plugin, register


class ServersPlugin(Plugin):
    """
    Adds additional support for showing information about servers including:

    * A panel which shows all servers a message was seen on.
    * A sidebar module which shows the servers most actively seen on.
    """
    slug = 'servers'
    title = _('Servers')
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/dcramer/sentry"

    def get_unique_servers(self, group):
        return group.messagefiltervalue_set.filter(key='server_name')\
                    .values_list('value')\
                    .annotate(times_seen=Sum('times_seen'))\
                    .values_list('value', 'times_seen', 'first_seen', 'last_seen')\
                    .order_by('-times_seen')

    def panels(self, request, group, panel_list, **kwargs):
        panel_list.append((self.get_title(), self.get_url(group)))
        return panel_list

    def view(self, request, group, **kwargs):
        return self.render('sentry/plugins/sentry_servers/index.html', {
            'unique_servers': self.get_unique_servers(group),
            'group': group,
        })

    def widget(self, request, group, **kwargs):
        return self.render('sentry/plugins/sentry_servers/widget.html', {
            'unique_servers': list(self.get_unique_servers(group)[:10]),
            'group': group,
        })
register(ServersPlugin)
