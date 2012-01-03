"""
sentry.views.query
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.utils.translation import ugettext as _
from .base import View

__all__ = ('Query',)


class Query(View):
    verbose_name = _('query')
    verbose_name_plural = _('queries')

    def should_store(self, event):
        return 'sentry.interfaces.Query' in event.interfaces
