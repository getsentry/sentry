"""
sentry.processors.console
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import print_function

from .base import Processor


class ConsoleProcessor(Processor):
    def post_process(self, event, **kwargs):
        print('Received an event:')
        print('  ID:', event.event_id)
        print('  Project:', event.project.name)
