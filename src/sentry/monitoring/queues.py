from datetime import datetime
from threading import Thread
from time import sleep
from typing import Dict, List, Tuple
from urllib.parse import urlparse

import requests
import sentry_sdk
from django.conf import settings
from django.utils.functional import cached_property

from sentry import options
from sentry.utils import redis

QUEUES = ["profiles.process"]

UNHEALTHY_KEY_NAME = "unhealthy-queues"
DEBUG_KEY_NAME = "queue-debug"


class RedisBackend:
    def __init__(self, broker_url):
        self.broker_url = broker_url

    @cached_property
    def client(self):
        from redis import StrictRedis

        return StrictRedis.from_url(self.broker_url)

    def get_memory_stats(self):
        info = self.client.info()
        return {
            "mem_used": info.get("used_memory", 0),
            "mem_limit": info.get("maxmemory", 0) or info.get("total_system_memory", 0),
        }

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
        self.hostname = host
        if port is None:
            port = 5672
        self.conn_info = dict(
            host="%s:%d" % (host, port),
            userid=dsn.username,
            password=dsn.password,
            virtual_host=dsn.path[1:] or "/",
        )

    def get_memory_stats(self):
        url = f"http://{self.hostname}:15672/api/nodes"
        user = self.conn_info["userid"]
        password = self.conn_info["password"]

        response = requests.get(url, auth=(user, password))
        response.raise_for_status()
        return {k: v for k, v in response.json()[0].items() if k in ["mem_used", "mem_limit"]}

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


backends = {"redis": RedisBackend, "amqp": AmqpBackend}

try:
    backend = get_backend_for_broker(settings.BROKER_URL)
except KeyError:
    backend = None


queue_monitoring_cluster = redis.redis_clusters.get(settings.SENTRY_QUEUE_MONITORING_REDIS_CLUSTER)


def _prefix_key(key_name: str) -> str:
    return f"bp1:{key_name}"


def _unhealthy_queue_key(queue_name: str) -> str:
    return _prefix_key(f"{UNHEALTHY_KEY_NAME}:{queue_name}")


def _debug_queue_key(queue_name: str) -> str:
    return _prefix_key(f"{DEBUG_KEY_NAME}:{queue_name}")


def is_queue_healthy(queue_name: str) -> bool:
    """Checks whether the given queue is healthy by looking it up in Redis.

    NB: If the queue is not found in Redis, it is assumed to be healthy.
    This behavior might change in the future.
    """

    if not options.get("backpressure.monitor_queues.enable_check"):
        return True
    # check if queue is healthy by pinging Redis
    try:
        # We set the key if the queue is unhealthy. If the key exists,
        # the queue is unhealthy and we need to return False.
        healthy = not queue_monitoring_cluster.exists(_unhealthy_queue_key(queue_name))
    except Exception as e:
        sentry_sdk.capture_exception(e)
        # By default it's considered healthy
        healthy = True
    return healthy


def _is_healthy(queue_size) -> bool:
    return queue_size < options.get("backpressure.monitor_queues.unhealthy_threshold")


def _update_queue_stats(queue_history: Dict[str, int]) -> None:
    strike_threshold = options.get("backpressure.monitor_queues.strike_threshold")
    queue_health = _list_queues_over_threshold(strike_threshold, queue_history)
    unhealthy_queues = [queue for (queue, is_unhealthy) in queue_health if is_unhealthy]
    if unhealthy_queues:
        # Report list of unhealthy queues to sentry
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("unhealthy_queues", unhealthy_queues)
            sentry_sdk.capture_message("RabbitMQ queues are exceeding size threshold")

    with queue_monitoring_cluster.pipeline() as pipeline:
        pipeline.hmset(_prefix_key("queue-history"), queue_history)
        for (queue, unhealthy) in queue_health:
            pipeline.set(_debug_queue_key(queue), datetime.utcnow().isoformat(), ex=300)
            if unhealthy:
                pipeline.set(_unhealthy_queue_key(queue), "1", ex=60)
            else:
                pipeline.delete(_unhealthy_queue_key(queue))
        pipeline.execute()


def _run_queue_stats_updater() -> None:
    queue_history = {queue: 0 for queue in QUEUES}
    while True:
        if not options.get("backpressure.monitor_queues.enable_status"):
            sleep(10)
            continue

        try:
            new_sizes = backend.bulk_get_sizes(QUEUES)
            for (queue, size) in new_sizes:
                if _is_healthy(size):
                    queue_history[queue] = 0
                else:
                    queue_history[queue] += 1
        except Exception as e:
            sentry_sdk.capture_exception(e)
            # If there was an error getting queue sizes from RabbitMQ, assume
            # all queues are unhealthy
            for queue in QUEUES:
                queue_history[queue] += 1

        try:
            _update_queue_stats(queue_history)
        except Exception as e:
            sentry_sdk.capture_exception(e)

        sleep(options.get("backpressure.monitor_queues.check_interval"))


def _list_queues_over_threshold(
    strike_threshold: int, queue_history: Dict[str, int]
) -> List[Tuple[str, bool]]:
    return [(queue, count >= strike_threshold) for (queue, count) in queue_history.items()]


def monitor_queues():
    if backend is None:
        return
    queue_stats_updater_process = Thread(
        target=_run_queue_stats_updater,
    )
    queue_stats_updater_process.start()
