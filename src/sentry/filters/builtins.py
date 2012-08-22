"""
sentry.filters.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.utils.datastructures import SortedDict
from django.utils.translation import ugettext_lazy as _
from sentry.conf import settings
from .base import Filter, GroupFilter

__all__ = ('StatusFilter', 'LoggerFilter', 'LevelFilter')


class StatusFilter(GroupFilter):
    label = _('Status')
    column = 'status'
    default = '0'

    def get_choices(self):
        return SortedDict([
            (0, _('Unresolved')),
            (1, _('Resolved')),
        ])


class LoggerFilter(Filter):
    label = _('Logger')
    column = 'logger'


class LevelFilter(Filter):
    label = _('Level')
    column = 'level'

    def get_choices(self):
        return SortedDict((str(k), v) for k, v in settings.LOG_LEVELS)

    def get_query_set(self, queryset):
        return queryset.filter(level=self.get_value())
