"""
sentry.queue.worker
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from kombu.mixins import ConsumerMixin
from kombu.utils import kwdict

from sentry.queue.queues import task_queues

import logging


class Worker(ConsumerMixin):
    def __init__(self, connection):
        self.connection = connection
        self.logger = logging.getLogger(__name__)

    def get_consumers(self, Consumer, channel):
        return [Consumer(queues=task_queues,
                         callbacks=[self.process_task])]

    def process_task(self, body, message):
        func = body["func"]
        args = body["args"]
        kwargs = body["kwargs"]
        self.logger.info("Got task: %r", func.__name__)
        try:
            func(*args, **kwdict(kwargs))
        except Exception, exc:
            self.logger.error("task raised exception: %r", exc)
        message.ack()

