from dataclasses import dataclass
from time import sleep
from typing import Dict, List
from urllib.parse import urlparse

import requests
import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.processing.backpressure.topology import ALL_QUEUES, CONSUMERS, Queue, Services
from sentry.utils import redis

QUEUES = ["profiles.process"]

UNHEALTHY_KEY_NAME = "unhealthy-consumers"
DEBUG_KEY_NAME = "queue-debug"


queue_monitoring_cluster = redis.redis_clusters.get(settings.SENTRY_QUEUE_MONITORING_REDIS_CLUSTER)


@dataclass(frozen=True)
class RabbitMqHost:
    hostname: str
    port: int
    vhost: str
    username: str
    password: str


def _parse_rabbitmq(host: Dict[str, str]) -> RabbitMqHost:
    if "url" not in host:
        raise ValueError("missing url")

    if "vhost" not in host:
        raise ValueError("missing vhost")

    url = host["url"]
    vhost = host["vhost"]
    dsn = urlparse(url)
    hostname, port = dsn.hostname, dsn.port
    username, password = dsn.username, dsn.password
    if port is None:
        port = 15672

    if hostname is None:
        raise ValueError("missing hostname")

    if username is None:
        raise ValueError("missing username")

    if password is None:
        raise ValueError("missing password")

    return RabbitMqHost(hostname, port, vhost, username, password)


def _prefix_key(key_name: str) -> str:
    return f"bp1:{key_name}"


def _unhealthy_consumer_key(consumer_name: str) -> str:
    return _prefix_key(f"{UNHEALTHY_KEY_NAME}:{consumer_name}")


def is_consumer_healthy(consumer_name: str = "default") -> bool:
    """Checks whether the given consumer is healthy by looking it up in Redis.

    NB: If the consumer is not found in Redis, it is assumed to be healthy.
    This behavior might change in the future.
    """

    if not options.get("backpressure.monitor_queues.enable_check"):
        return True
    # check if queue is healthy by pinging Redis
    try:
        # We set the key if the queue is unhealthy. If the key exists,
        # the queue is unhealthy and we need to return False.
        healthy = not queue_monitoring_cluster.exists(_unhealthy_consumer_key(consumer_name))
        # TODO: do we want to also check the `default` consumer as a catch-all?
    except Exception as e:
        sentry_sdk.capture_exception(e)
        # By default it's considered healthy
        healthy = True
    return healthy


def _get_queue_sizes(hosts: List[RabbitMqHost], queues: List[str]) -> Dict[str, int]:
    new_sizes = {queue: 0 for queue in queues}

    for host in hosts:
        url = f"http://{host.hostname}:{host.port}/api/queues/{host.vhost}"
        response = requests.get(url, auth=(host.username, host.password))
        response.raise_for_status()

        for queue in response.json():
            name = queue["name"]
            size = queue["messages"]
            if name in queues:
                new_sizes[name] = max(new_sizes[name], size)

    return new_sizes


def _update_queue_stats(queue_history: Dict[str, int]) -> None:
    strike_threshold = options.get("backpressure.monitor_queues.strike_threshold")
    queue_health = _list_queues_over_threshold(strike_threshold, queue_history)

    unhealthy_queues = [queue for (queue, is_unhealthy) in queue_health.items() if is_unhealthy]
    if unhealthy_queues:
        # Report list of unhealthy queues to sentry
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("unhealthy_queues", unhealthy_queues)
            sentry_sdk.capture_message("RabbitMQ queues are exceeding size threshold")

    with queue_monitoring_cluster.pipeline() as pipeline:
        # write the queue history to redis, for debugging purposes
        pipeline.hmset(_prefix_key("queue-history"), queue_history)

        # update health markers for services
        for (consumer_name, services) in CONSUMERS.items():
            unhealthy = _check_consumer_health(services, queue_health)

            if unhealthy:
                pipeline.set(_unhealthy_consumer_key(consumer_name), "1", ex=60)
            else:
                pipeline.delete(_unhealthy_consumer_key(consumer_name))

        pipeline.execute()


def _check_consumer_health(services: Services, queue_health: Dict[str, bool]) -> bool:
    """
    Checks all the queues in `services` for their health.
    """
    for service in services:
        # TODO: we want to eventually also check the redis stores
        if isinstance(service, Queue):
            if queue_health.get(service.name, False):
                return False
    return True


def _is_healthy(queue_size) -> bool:
    return queue_size < options.get("backpressure.monitor_queues.unhealthy_threshold")


def run_queue_stats_updater() -> None:
    hosts = []
    for host in settings.SENTRY_QUEUE_MONITORING_RABBITMQ_HOSTS:
        try:
            hosts.append(_parse_rabbitmq(host))
        except ValueError as e:
            with sentry_sdk.push_scope() as scope:
                scope.set_extra("invalid_host", host)
                sentry_sdk.capture_exception(e)

    queue_history = {queue: 0 for queue in ALL_QUEUES}

    while True:
        if not options.get("backpressure.monitor_queues.enable_status"):
            sleep(10)
            continue

        try:
            new_sizes = _get_queue_sizes(hosts, ALL_QUEUES)
            for (queue, size) in new_sizes.items():
                if _is_healthy(size):
                    queue_history[queue] = 0
                else:
                    queue_history[queue] += 1
        except Exception as e:
            sentry_sdk.capture_exception(e)
            # If there was an error getting queue sizes from RabbitMQ, assume
            # all queues are unhealthy
            for queue in ALL_QUEUES:
                queue_history[queue] += 1

        try:
            _update_queue_stats(queue_history)
        except Exception as e:
            sentry_sdk.capture_exception(e)

        sleep(options.get("backpressure.monitor_queues.check_interval"))


def _list_queues_over_threshold(
    strike_threshold: int, queue_history: Dict[str, int]
) -> Dict[str, bool]:
    return {queue: count >= strike_threshold for (queue, count) in queue_history.items()}
