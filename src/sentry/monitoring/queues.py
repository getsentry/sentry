"""
sentry.monitoring.queues
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


class RedisBackend(object):
    def __init__(self, app):
        from redis import StrictRedis
        self.client = StrictRedis.from_url(app.conf.BROKER_URL)

    def bulk_get_sizes(self, queues):
        return [(queue.name, self.get_size(queue)) for queue in queues]

    def get_size(self, queue):
        return self.client.llen(queue.name)

    def purge_queue(self, queue):
        # This is slightly inaccurate since things could be queued between calling
        # LLEN and DEL, but it's close enough for this use case.
        size = self.get_size(queue)
        self.client.delete(queue.name)
        return size


class AmqpBackend(object):
    def __init__(self, app):
        self.app = app

    def _get_size_from_conn(self, conn, queue):
        # In AMQP, the way to do this is to attempt to create a queue passively.
        # which is basically checking for it's existence (passive=True), this also
        # returns back the queue size.
        _, size, _ = self.app.amqp.queues[queue.name](conn.default_channel).queue_declare(passive=True)
        return size

    def bulk_get_sizes(self, queues):
        sizes = []
        with self.app.connection_or_acquire() as conn:
            for queue in queues:
                sizes.append((queue.name, self._get_size_from_conn(conn, queue)))
        return sizes

    def get_size(self, queue):
        with self.app.connection_or_acquire() as conn:
            return self._get_size_from_conn(conn, queue)

    def purge_queue(self, queue):
        with self.app.connection_or_acquire() as conn:
            return self.app.amqp.queues[queue.name](conn.default_channel).purge()


def get_backend_for_celery(app):
    from urlparse import urlparse
    return backends[urlparse(app.conf.BROKER_URL).scheme](app)


backends = {
    'redis': RedisBackend,
    'amqp': AmqpBackend,

    # Ideally these are never used
    'librabbitmq': AmqpBackend,
    'pyamqp': AmqpBackend,
}
