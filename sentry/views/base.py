"""
sentry.views.base
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.conf import settings
from sentry.utils import InstanceManager

__all__ = ('View',)


class View(object):
    verbose_name = None
    verbose_name_plural = None
    ref = None  # we cache the actual object here

    def should_store(self, event):
        return False

    objects = InstanceManager(settings.VIEWS)
