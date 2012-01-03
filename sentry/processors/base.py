"""
sentry.processors.base
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.conf import settings
from sentry.utils import InstanceManager

__all__ = ('Processor',)


class Processor(object):
    conditions = {}

    def post_processing(self, event):
        """
        Called every time an event is created
        """
        return

    handlers = InstanceManager(settings.PROCESSORS)


def post_save_processors(sender, **kwargs):
    for processor in Processor.handlers.all():
        processor.post_processing(sender)
