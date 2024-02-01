import logging
from typing import Mapping

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.processing.backpressure.topology import CONSUMERS
from sentry.utils import metrics, redis

logger = logging.getLogger(__name__)


def _prefix_key(key_name: str) -> str:
    return f"bp1:{key_name}"


def _consumer_key(name: str) -> str:
    return _prefix_key(f"consumer_is_healthy:{name}")


def _service_key(name: str) -> str:
    return _prefix_key(f"service_is_healthy:{name}")


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
        consumer_healthy = service_monitoring_cluster.get(_consumer_key(consumer_name))

        if consumer_healthy != "true":
            reason = "status-missing" if consumer_healthy is None else "unhealthy"
            metrics.incr(
                "backpressure.consumer.unhealthy",
                tags={
                    "consumer": consumer_name,
                    "reason": reason,
                },
            )
            with sentry_sdk.push_scope():
                sentry_sdk.set_tag("consumer", consumer_name)
                sentry_sdk.set_tag("reason", reason)
                logger.error(
                    "Consumer `%s` stopped for reason `%s`",
                    consumer_name,
                    reason,
                )

            return False
        return True
    except Exception as e:
        sentry_sdk.capture_exception(e)

        metrics.incr(
            "backpressure.consumer.unhealthy", tags={"consumer": consumer_name, "reason": "error"}
        )
        with sentry_sdk.push_scope():
            sentry_sdk.set_tag("consumer", consumer_name)
            sentry_sdk.set_tag("reason", "error")
            logger.exception("Consumer `%s` stopped due to for reason `%s`", consumer_name, "error")

        return False


def record_consumer_health(service_health: Mapping[str, bool]) -> None:
    with service_monitoring_cluster.pipeline() as pipeline:
        key_ttl = options.get("backpressure.status_ttl")

        for name, is_healthy in service_health.items():
            pipeline.set(_service_key(name), "true" if is_healthy else "false", ex=key_ttl)

            if not is_healthy:
                metrics.incr("backpressure.monitor.service.unhealthy", tags={"service": name})
                with sentry_sdk.push_scope():
                    sentry_sdk.set_tag("service", name)
                    logger.error("Service `%s` marked as unhealthy", name)

        for name, dependencies in CONSUMERS.items():
            is_healthy = True
            for dependency in dependencies:
                is_healthy = is_healthy and service_health[dependency]

            pipeline.set(_consumer_key(name), "true" if is_healthy else "false", ex=key_ttl)

            if not is_healthy:
                metrics.incr("backpressure.monitor.consumer.unhealthy", tags={"consumer": name})
                with sentry_sdk.push_scope():
                    sentry_sdk.set_tag("consumer", name)
                    logger.error("Consumer `%s` marked as unhealthy", name)

        pipeline.execute()
