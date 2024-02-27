import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.processing.backpressure.memory import ServiceMemory
from sentry.processing.backpressure.topology import CONSUMERS
from sentry.utils import metrics, redis

logger = logging.getLogger(__name__)

UnhealthyReasons = Exception | list[ServiceMemory]


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

    # it's never valid to have checking enabled without monitoring.
    # log an error and return False immediately
    if not options.get("backpressure.monitoring.enabled"):
        logger.error(
            "Invalid state: `backpressure.checking.enabled` is `True`, but "
            "`backpressure.monitoring.enabled` "
            "is `False`.\n\nIf you meant to disable backpressure checking, set "
            "`backpressure.checking.enabled` to `False`. Otherwise set "
            "`backpressure.monitoring.enabled` to `True` or the backpressure "
            "system will not work correctly."
        )
        return False

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


def record_consumer_health(unhealthy_services: Mapping[str, UnhealthyReasons]) -> None:
    with service_monitoring_cluster.pipeline() as pipeline:
        key_ttl = options.get("backpressure.status_ttl")

        for name, unhealthy_reasons in unhealthy_services.items():
            pipeline.set(_service_key(name), "false" if unhealthy_reasons else "true", ex=key_ttl)

            extra: dict[str, Any] = {}
            if unhealthy_reasons:
                if isinstance(unhealthy_reasons, Exception):
                    extra = {"exception": unhealthy_reasons}
                else:
                    for memory in unhealthy_reasons:
                        extra[memory.name] = {
                            "used": memory.used,
                            "available": memory.available,
                            "percentage": memory.percentage,
                        }

                metrics.incr("backpressure.monitor.service.unhealthy", tags={"service": name})
                with sentry_sdk.push_scope():
                    sentry_sdk.set_tag("service", name)
                    logger.error("Service `%s` marked as unhealthy", name, extra=extra)

        for name, dependencies in CONSUMERS.items():
            unhealthy_dependencies = []
            for dependency in dependencies:
                if unhealthy_services[dependency]:
                    unhealthy_dependencies.append(dependency)

            pipeline.set(
                _consumer_key(name), "false" if unhealthy_dependencies else "true", ex=key_ttl
            )

            if unhealthy_dependencies:
                metrics.incr("backpressure.monitor.consumer.unhealthy", tags={"consumer": name})
                with sentry_sdk.push_scope():
                    sentry_sdk.set_tag("consumer", name)
                    logger.error(
                        "Consumer `%s` marked as unhealthy",
                        name,
                        extra={"unhealthy_dependencies": unhealthy_dependencies},
                    )

        pipeline.execute()
