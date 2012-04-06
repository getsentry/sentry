"""
sentry.plugins.sentry_sites.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import sentry

from django.conf import settings as django_settings
from django.db.models import Sum
from django.utils.translation import ugettext_lazy as _

from sentry.conf import settings
from sentry.filters import Filter
from sentry.models import Event
from sentry.plugins import Plugin, register


class SiteFilter(Filter):
    label = _('Site')
    column = 'site'

    def process(self, data):
        if 'site' in data:
            return data
        if settings.SITE is None:
            if 'django.contrib.sites' in django_settings.INSTALLED_APPS:
                from django.contrib.sites.models import Site
                try:
                    settings.SITE = Site.objects.get_current().name
                except Site.DoesNotExist:
                    settings.SITE = ''
            else:
                settings.SITE = ''
        if settings.SITE:
            data['site'] = settings.SITE
        return data

    def get_query_set(self, queryset):
        if queryset.model == Event:
            return queryset.filter(site=self.get_value()).distinct()
        else:
            return queryset.filter(event_set__site=self.get_value()).distinct()


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

    def get_filters(self, project=None, **kwargs):
        return [SiteFilter]
register(SitesPlugin)
