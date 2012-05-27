"""
sentry.plugins.sentry_sites.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import sentry

from django.utils.translation import ugettext_lazy as _

from sentry.filters import Filter
from sentry.models import Event
from sentry.plugins import register
from sentry.plugins.bases.tag import TagPlugin


class SiteFilter(Filter):
    label = _('Site')
    column = 'site'

    def get_query_set(self, queryset):
        if queryset.model == Event:
            return queryset.filter(site=self.get_value()).distinct()
        else:
            return queryset.filter(event_set__site=self.get_value()).distinct()


class SitesPlugin(TagPlugin):
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
    tag = 'site'
    tag_label = _('Site')

    def get_tag_values(self, event):
        if not event.site:
            return []
        return [event.site]

    def get_filters(self, project=None, **kwargs):
        return [SiteFilter]

register(SitesPlugin)
