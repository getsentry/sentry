"""
sentry.queue.worker
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from kombu.mixins import ConsumerMixin
from kombu.utils import kwdict, reprcall

from sentry.queue.queues import task_queues


class Worker(ConsumerMixin):
    def __init__(self, connection):
        self.connection = connection

    def get_consumers(self, Consumer, channel):
        return [Consumer(queues=task_queues,
                         callbacks=[self.process_task])]

    def process_task(self, body, message):
        func = body["func"]
        args = body["args"]
        kwargs = body["kwargs"]
        self.info("Got task: %s", reprcall(func.__name__, args, kwargs))
        try:
            func(*args, **kwdict(kwargs))
        except Exception, exc:
            self.error("task raised exception: %r", exc)
        message.ack()

