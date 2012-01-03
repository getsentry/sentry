"""
sentry.processors.base
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.conf import settings
from sentry.utils import InstanceManager


class Processor(object):
    conditions = {}

    def post_processing(self, event):
        """
        Called every time an event is created
        """
        return

    objects = InstanceManager(settings.PROCESSORS)


def post_save_processors(sender, **kwargs):
    for processor in Processor.objects.all():
        processor.post_processing(sender)
