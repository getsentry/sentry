"""
sentry.plugins.sentry_sites
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import sentry

from django.db.models import Sum
from django.utils.translation import ugettext_lazy as _

from sentry.plugins import Plugin, register


class SitesPlugin(Plugin):
    """
    Adds additional support for showing information about sites including:

    * A panel which shows all sites a message was seen on.
    * A sidebar module which shows the sites most actively seen on.
    """
    slug = 'sites'
    title = _('Sites')
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/dcramer/sentry"

    def get_unique_sites(self, group):
        return group.messagefiltervalue_set.filter(key='site')\
                    .values_list('value')\
                    .annotate(times_seen=Sum('times_seen'))\
                    .values_list('value', 'times_seen', 'first_seen', 'last_seen')\
                    .order_by('-times_seen')

    def panels(self, request, group, panel_list, **kwargs):
        panel_list.append((self.get_title(), self.get_url(group)))
        return panel_list

    def view(self, request, group, **kwargs):
        return self.render('sentry/plugins/sentry_sites/index.html', {
            'group': group,
            'unique_sites': self.get_unique_sites(group),
        })

    def widget(self, request, group, **kwargs):
        return self.render('sentry/plugins/sentry_sites/widget.html', {
            'group': group,
            'unique_sites': list(self.get_unique_sites(group)[:10]),
        })
register(SitesPlugin)
