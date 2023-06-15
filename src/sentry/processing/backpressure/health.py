from typing import Mapping

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.processing.backpressure.topology import CONSUMERS
from sentry.utils import redis


def _prefix_key(key_name: str) -> str:
    return f"bp1:{key_name}"


UNHEALTHY_KEY_NAME = "unhealthy-consumers"


def _unhealthy_consumer_key(name: str) -> str:
    return _prefix_key(f"{UNHEALTHY_KEY_NAME}:{name}")


service_monitoring_cluster = redis.redis_clusters.get(
    settings.SENTRY_SERVICE_MONITORING_REDIS_CLUSTER
)


def is_consumer_healthy(consumer_name: str = "default") -> bool:
    """Checks whether the given consumer is healthy by looking it up in Redis.

    NB: If the consumer is not found in Redis, it is assumed to be healthy.
    This behavior might change in the future.
    """

    if not options.get("backpressure.checking.enabled"):
        return True
    # check if queue is healthy by pinging Redis
    try:
        # We set the key if the queue is unhealthy. If the key exists,
        # the queue is unhealthy and we need to return False.
        healthy = not service_monitoring_cluster.exists(_unhealthy_consumer_key(consumer_name))
        # TODO: do we want to also check the `default` consumer as a catch-all?
    except Exception as e:
        sentry_sdk.capture_exception(e)
        # By default it's considered healthy
        healthy = True
    return healthy


def record_consumer_heath(service_health: Mapping[str, bool]) -> None:
    with service_monitoring_cluster.pipeline() as pipeline:
        for name, dependencies in CONSUMERS.items():
            is_healthy = True
            for dependency in dependencies:
                is_healthy = is_healthy and service_health.get(dependency, True)

            if not is_healthy:
                pipeline.set(_unhealthy_consumer_key(name), "1", ex=60)
            else:
                pipeline.delete(_unhealthy_consumer_key(name))

        pipeline.execute()
