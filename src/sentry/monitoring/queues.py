from threading import Thread
from time import sleep
from urllib.parse import urlparse

from django.conf import settings
from django.utils.functional import cached_property

from sentry.utils import redis

QUEUES = ["profiles.process"]

KEY_NAME = "unhealthy-queues"

CLUSTER_NAME = "default"


class RedisBackend:
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


class AmqpBackend:
    def __init__(self, broker_url):
        dsn = urlparse(broker_url)
        host, port = dsn.hostname, dsn.port
        if port is None:
            port = 5672
        self.conn_info = dict(
            host="%s:%d" % (host, port),
            userid=dsn.username,
            password=dsn.password,
            virtual_host=dsn.path[1:] or "/",
        )

    def get_conn(self):
        from amqp import Connection

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


queue_monitoring_cluster = redis.redis_clusters.get(CLUSTER_NAME)


def is_queue_healthy(queue_name: str) -> bool:
    # check if queue is healthy by pinging Redis
    return not queue_monitoring_cluster.sismember(KEY_NAME, queue_name)


def is_healthy(queue_size):
    return queue_size < 1000


def update_queue_stats(redis_cluster, backend) -> None:
    new_sizes = backend.bulk_get_sizes(QUEUES)
    # compute unhealthiness based on sizes
    unhealthy = {queue for (queue, size) in new_sizes if not is_healthy(size)}
    if unhealthy:
        with redis_cluster.pipeline(transaction=True) as pipeline:
            pipeline.delete(KEY_NAME)
            pipeline.sadd(KEY_NAME, *unhealthy)
            # expire in 1min if we haven't checked in
            pipeline.expire(KEY_NAME, 60)
            pipeline.execute()


def run_queue_stats_updater(redis_cluster: str) -> None:
    # bonus point if we manage to use asyncio and launch all tasks at once
    # in case we have many queues to check
    cluster = redis.redis_clusters.get(redis_cluster)
    from sentry.monitoring.queues import backend

    if backend is None:
        raise Exception("unknown broker type")
    while True:
        update_queue_stats(cluster, backend)
        sleep(5)


class QueueMonitor:
    def __init__(self):
        queue_stats_updater_process = Thread(target=run_queue_stats_updater, args=(CLUSTER_NAME,))
        queue_stats_updater_process.start()


backends = {"redis": RedisBackend, "amqp": AmqpBackend}

try:
    backend = get_backend_for_broker(settings.BROKER_URL)
except KeyError:
    backend = None
