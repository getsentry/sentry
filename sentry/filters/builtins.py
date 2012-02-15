"""
sentry.filters.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.conf import settings as django_settings
from django.utils.datastructures import SortedDict
from sentry.conf import settings
from sentry.models import Event
from .base import Filter, GroupFilter

__all__ = ('StatusFilter', 'LoggerFilter', 'ServerNameFilter', 'SiteFilter',
           'LevelFilter')


class StatusFilter(GroupFilter):
    label = 'Status'
    column = 'status'
    default = '0'

    def get_choices(self):
        return SortedDict([
            (0, 'Unresolved'),
            (1, 'Resolved'),
        ])


class LoggerFilter(Filter):
    label = 'Logger'
    column = 'logger'


class ServerNameFilter(Filter):
    label = 'Server Name'
    column = 'server_name'

    def get_query_set(self, queryset):
        if queryset.model == Event:
            return queryset.filter(server_name=self.get_value()).distinct()
        else:
            return queryset.filter(event_set__server_name=self.get_value()).distinct()


class LevelFilter(Filter):
    label = 'Level'
    column = 'level'

    def get_choices(self):
        return SortedDict((str(k), v) for k, v in settings.LOG_LEVELS)

    def get_query_set(self, queryset):
        return queryset.filter(level=self.get_value())


class SiteFilter(Filter):
    label = 'Site'
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
