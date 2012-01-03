"""
sentry.views.message
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.utils.translation import ugettext as _
from .base import View

__all__ = ('Message',)


class Message(View):
    verbose_name = _('message')
    verbose_name_plural = _('messages')
