from __future__ import annotations

import logging
import threading
from collections.abc import Mapping, Sequence

import sentry_sdk
from django.conf import settings
from redis.client import StrictRedis
from sentry_redis_tools.clients import RedisCluster

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
            metrics.event(
                "backpressure.consumer.unhealthy",
                message=reason,
                alert_type="error",
                tags={
                    "consumer": consumer_name,
                    "reason": reason,
                },
            )
            with sentry_sdk.isolation_scope():
                sentry_sdk.set_tag("consumer", consumer_name)
                sentry_sdk.set_attribute("consumer", consumer_name)
                sentry_sdk.set_tag("reason", reason)
                sentry_sdk.set_attribute("reason", reason)
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
        metrics.event(
            "backpressure.consumer.unhealthy",
            message="error",
            alert_type="error",
            tags={"consumer": consumer_name, "reason": "error"},
        )
        with sentry_sdk.isolation_scope():
            sentry_sdk.set_tag("consumer", consumer_name)
            sentry_sdk.set_attribute("consumer", consumer_name)
            sentry_sdk.set_tag("reason", "error")
            sentry_sdk.set_attribute("reason", "error")
            logger.exception("Consumer `%s` stopped due to for reason `%s`", consumer_name, "error")

        return False


def _write_health_values(
    cluster: RedisCluster[str] | StrictRedis[str], health_values: Mapping[str, str], key_ttl: int
) -> None:
    with cluster.pipeline() as pipeline:
        for key, value in health_values.items():
            pipeline.set(key, value, ex=key_ttl)
        pipeline.execute()


def record_consumer_health(unhealthy_services: Mapping[str, UnhealthyReasons]) -> None:
    key_ttl = options.get("backpressure.status_ttl")
    health_values: dict[str, str] = {}

    for name, unhealthy_reasons in unhealthy_services.items():
        health_values[_service_key(name)] = "false" if unhealthy_reasons else "true"

        if unhealthy_reasons:
            metrics.incr("backpressure.monitor.service.unhealthy", tags={"service": name})
            metrics.event(
                "backpressure.monitor.service.unhealthy",
                message=str(unhealthy_reasons),
                alert_type="error" if isinstance(unhealthy_reasons, Exception) else "info",
                tags={"service": name},
            )
            with sentry_sdk.isolation_scope():
                sentry_sdk.set_tag("service", name)
                sentry_sdk.set_attribute("service", name)

    for name, dependencies in CONSUMERS.items():
        unhealthy_dependencies = []
        for dependency in dependencies:
            if unhealthy_services[dependency]:
                unhealthy_dependencies.append(dependency)

        health_values[_consumer_key(name)] = "false" if unhealthy_dependencies else "true"

        if unhealthy_dependencies:
            metrics.incr("backpressure.monitor.consumer.unhealthy", tags={"consumer": name})
            metrics.event(
                "backpressure.monitor.consumer.unhealthy",
                message="error",
                alert_type="error",
                tags={"consumer": name},
            )
            with sentry_sdk.isolation_scope():
                sentry_sdk.set_tag("consumer", name)
                sentry_sdk.set_attribute("consumer", name)
                logger.error(
                    "Consumer `%s` marked as unhealthy",
                    name,
                    extra={"unhealthy_dependencies": unhealthy_dependencies},
                )

    # The primary first, so its write timing does not change.
    _write_health_values(service_monitoring_cluster, health_values, key_ttl)

    cluster_ids = list(settings.SENTRY_SERVICE_MONITORING_REDIS_SECONDARY_CLUSTERS)
    if cluster_ids:
        _start_secondary_write(cluster_ids, health_values, key_ttl)


# Background thread for the secondary writes. A hung Redis Cluster node can block a write for
# minutes (redis-py-cluster retries each timed out command up to 16 times), which is longer than
# the key TTL. If the loop waited, the primary keys would expire and readers would pause.
_secondary_write_thread: threading.Thread | None = None


def _start_secondary_write(
    cluster_ids: Sequence[str], health_values: Mapping[str, str], key_ttl: int
) -> None:
    global _secondary_write_thread

    # Only one secondary write at a time. While the previous one runs, skip this loop's write.
    if _secondary_write_thread is not None and _secondary_write_thread.is_alive():
        metrics.incr("backpressure.monitor.secondary_write.skipped")
        return

    # Daemon, so a hung write does not block process shutdown.
    _secondary_write_thread = threading.Thread(
        target=_write_secondary_clusters,
        args=(cluster_ids, health_values, key_ttl),
        name="backpressure-secondary-write",
        daemon=True,
    )
    _secondary_write_thread.start()


def _write_secondary_clusters(
    cluster_ids: Sequence[str], health_values: Mapping[str, str], key_ttl: int
) -> None:
    # One cluster after the other. A failure must not stop the writes to the other clusters.
    # Resolved on each call, so a wrong cluster id is caught here too.
    for cluster_id in cluster_ids:
        try:
            _write_health_values(redis.redis_clusters.get(cluster_id), health_values, key_ttl)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            metrics.incr(
                "backpressure.monitor.secondary_write.failed", tags={"cluster": cluster_id}
            )
