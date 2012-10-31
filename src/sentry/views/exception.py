"""
sentry.views.exception
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.utils.translation import ugettext as _
from .base import View

__all__ = ('Exception',)


class Exception(View):
    verbose_name = _('Exception')
    verbose_name_plural = _('Exceptions')

    def should_store(self, event):
        return 'sentry.interfaces.Exception' in event.interfaces
