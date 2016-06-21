"""
sentry.monitoring.queues
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from urlparse import urlparse
from django.conf import settings
from django.utils.functional import cached_property


class RedisBackend(object):
    def __init__(self, broker_url):
        self.broker_url = broker_url

    @cached_property
    def client(self):
        from redis import StrictRedis
        return StrictRedis.from_url(self.broker_url)

    def bulk_get_sizes(self, queues):
        return [(queue, self.get_size(queue)) for queue in queues]

    def get_size(self, queue):
        return self.client.llen(queue)

    def purge_queue(self, queue):
        # This is slightly inaccurate since things could be queued between calling
        # LLEN and DEL, but it's close enough for this use case.
        size = self.get_size(queue)
        self.client.delete(queue)
        return size


class AmqpBackend(object):
    def __init__(self, broker_url):
        dsn = urlparse(broker_url)
        self.conn_info = dict(
            host=dsn.hostname,
            port=dsn.port,
            userid=dsn.username,
            password=dsn.password,
            virtual_host=dsn.path[1:],
        )

    def get_conn(self):
        from librabbitmq import Connection
        return Connection(**self.conn_info)

    def _get_size_from_channel(self, channel, queue):
        # In AMQP, the way to do this is to attempt to create a queue passively.
        # which is basically checking for it's existence (passive=True), this also
        # returns back the queue size.
        try:
            _, size, _ = channel.queue_declare(queue, passive=True)
        except Exception:
            return 0
        return size

    def bulk_get_sizes(self, queues):
        sizes = []
        with self.get_conn() as conn:
            with conn.channel() as channel:
                for queue in queues:
                    sizes.append((queue, self._get_size_from_channel(channel, queue)))
                return sizes

    def get_size(self, queue):
        with self.get_conn() as conn:
            with conn.channel() as channel:
                return self._get_size_from_channel(channel, queue)

    def purge_queue(self, queue):
        with self.get_conn() as conn:
            with conn.channel() as channel:
                return channel.queue_purge(queue)


def get_backend_for_broker(broker_url):
    if broker_url is None:
        raise KeyError
    return backends[urlparse(broker_url).scheme](broker_url)


def get_queue_by_name(name):
    "Lookup a celery Queue object by it's name"
    for queue in settings.CELERY_QUEUES:
        if queue.name == name:
            return queue

backends = {
    'redis': RedisBackend,
    'amqp': AmqpBackend,
    'librabbitmq': AmqpBackend,
}

try:
    backend = get_backend_for_broker(settings.BROKER_URL)
except KeyError:
    backend = None
