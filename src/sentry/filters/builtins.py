"""
sentry.filters.base
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from collections import OrderedDict

from django.utils.translation import ugettext_lazy as _

from sentry.models import GroupStatus

from .base import Filter

__all__ = ('StatusFilter',)


STATUS_LEVELS = (
    (GroupStatus.UNRESOLVED, _('Unresolved')),
    (GroupStatus.RESOLVED, _('Resolved')),
    (GroupStatus.MUTED, _('Muted')),
)


class StatusFilter(Filter):
    label = _('Status')
    column = 'status'
    default = '0'
    choices = OrderedDict(STATUS_LEVELS)

    def get_choices(self):
        return self.choices
