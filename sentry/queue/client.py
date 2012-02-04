"""
sentry.queue.client
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.conf import settings
from sentry.queue.queues import task_queues, task_exchange


from kombu import BrokerConnection
from kombu.common import maybe_declare
from kombu.pools import producers


class Broker(object):
    def __init__(self, config):
        self.config = config

    def _get_connection(self):
        if hasattr(self, '_connection'):
            return self._connection

        self._connection = BrokerConnection(**self.config)

        with producers[self.connection].acquire(block=False) as producer:
            for queue in task_queues:
                maybe_declare(queue, producer.channel)

    def delay(self, func, *args, **kwargs):
        payload = {
            "func": func,
            "args": args,
            "kwargs": kwargs,
        }

        with producers[self.connection].acquire(block=False) as producer:
            producer.publish(payload,
                exchange=task_exchange,
                serializer="pickle",
                compression="bzip2",
                queue='sentry.default',
                routing_key='sentry.default',
            )


class EagerBroker(Broker):
    """
    Executes tasks within the same process.
    """
    def delay(self, func, *args, **kwargs):
        return func(*args, **kwargs)

if not settings.USE_QUEUE:
    broker = EagerBroker(settings.QUEUE)
else:
    broker = Broker(settings.QUEUE)
delay = broker.delay
