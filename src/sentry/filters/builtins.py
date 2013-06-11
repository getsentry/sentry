"""
sentry.filters.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.utils.datastructures import SortedDict
from django.utils.translation import ugettext_lazy as _
from sentry.constants import STATUS_LEVELS
from .base import Filter

__all__ = ('StatusFilter',)


class StatusFilter(Filter):
    label = _('Status')
    column = 'status'
    default = '0'
    choices = SortedDict(STATUS_LEVELS)

    def get_choices(self):
        return self.choices
