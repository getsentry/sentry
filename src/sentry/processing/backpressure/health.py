from typing import Mapping

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.processing.backpressure.topology import CONSUMERS
from sentry.utils import redis


def _prefix_key(key_name: str) -> str:
    return f"bp1:{key_name}"


HEALTHY_KEY_NAME = "consumer_is_healthy"


def _unhealthy_consumer_key(name: str) -> str:
    return _prefix_key(f"{HEALTHY_KEY_NAME}:{name}")


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
        return service_monitoring_cluster.get(_unhealthy_consumer_key(consumer_name)) == "true"
    except Exception as e:
        sentry_sdk.capture_exception(e)
        # By default it's considered unhealthy
        return False


def record_consumer_health(service_health: Mapping[str, bool]) -> None:
    with service_monitoring_cluster.pipeline() as pipeline:
        key_ttl = options.get("backpressure.status_ttl")
        for name, dependencies in CONSUMERS.items():
            is_healthy = True
            for dependency in dependencies:
                is_healthy = is_healthy and service_health[dependency]

            pipeline.set(
                _unhealthy_consumer_key(name), "true" if is_healthy else "false", ex=key_ttl
            )

        pipeline.execute()
