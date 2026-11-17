import threading
import time
from collections.abc import MutableMapping
from unittest import mock

import pytest
from django.test.utils import override_settings

from sentry import options
from sentry.processing.backpressure import health
from sentry.processing.backpressure.health import (
    UnhealthyReasons,
    _consumer_key,
    _service_key,
    _write_health_values,
    is_consumer_healthy,
    record_consumer_health,
    service_monitoring_cluster,
)
from sentry.processing.backpressure.monitor import (
    Redis,
    assert_all_services_defined,
    check_service_health,
    load_service_definitions,
)
from sentry.processing.backpressure.topology import CONSUMERS
from sentry.testutils.helpers.options import override_options
from sentry.utils import redis


def test_loading_definitions() -> None:
    with override_settings(SENTRY_PROCESSING_SERVICES={"redis": {"redis": "default"}}):
        services = load_service_definitions()
        assert "redis" in services

    with pytest.raises(ValueError):
        assert_all_services_defined(
            {
                "sellerie": None,  # oops
                "processing-store": None,
                "processing-locks": None,
                "post-process-locks": None,
            }
        )


def test_check_redis_health() -> None:
    _, cluster, _ = redis.get_dynamic_cluster_from_options(
        setting="tess", config={"cluster": "default"}, decode_responses=True
    )
    services = {"redis": Redis(cluster)}

    with override_options(
        {
            "backpressure.high_watermarks.redis": 1.0,
        }
    ):
        unhealthy_services = check_service_health(services)
        assert not unhealthy_services["redis"]

    with override_options(
        {
            # NOTE: the default cluster for local testing will return *some* kind of used and available memory
            "backpressure.high_watermarks.redis": 0.0,
        }
    ):
        unhealthy_services = check_service_health(services)
        assert unhealthy_services["redis"]


@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.monitoring.enabled": True,
        "backpressure.status_ttl": 60,
    }
)
def test_record_consumer_health() -> None:
    unhealthy_services: MutableMapping[str, UnhealthyReasons] = {
        "processing-store": [],
        "processing-store-transactions": [],
        "processing-locks": [],
        "post-process-locks": [],
    }
    record_consumer_health(unhealthy_services)
    assert is_consumer_healthy() is True

    unhealthy_services["processing-store"] = Exception("Couldn't check processing-store")
    record_consumer_health(unhealthy_services)
    assert is_consumer_healthy() is False

    with pytest.raises(KeyError):
        record_consumer_health(
            {
                "sellerie": [],  # oops
                "processing-store": [],
                "processing-locks": [],
                "post-process-locks": [],
            }
        )


HEALTHY_SERVICES: dict[str, UnhealthyReasons] = {
    "processing-store": [],
    "processing-store-transactions": [],
    "processing-locks": [],
    "post-process-locks": [],
}

HEALTH_KEYS = [_service_key(name) for name in HEALTHY_SERVICES] + [
    _consumer_key(name) for name in CONSUMERS
]


def wait_for_secondary_write() -> None:
    thread = health._secondary_write_thread
    assert thread is not None
    thread.join(timeout=10)
    assert not thread.is_alive()


@override_options({"backpressure.status_ttl": 60})
def test_record_consumer_health_writes_secondary_clusters() -> None:
    secondary = redis.redis_clusters.get("cluster")
    secondary.delete(*HEALTH_KEYS)

    unhealthy_services: dict[str, UnhealthyReasons] = {
        **HEALTHY_SERVICES,
        "processing-store": Exception("Couldn't check processing-store"),
    }
    with override_settings(SENTRY_SERVICE_MONITORING_REDIS_SECONDARY_CLUSTERS=["cluster"]):
        record_consumer_health(unhealthy_services)
        wait_for_secondary_write()

    for key in HEALTH_KEYS:
        assert secondary.get(key) == service_monitoring_cluster.get(key)
        assert secondary.get(key) in ("true", "false")
        assert 0 < secondary.ttl(key) <= 60
        assert 0 < service_monitoring_cluster.ttl(key) <= 60
    assert secondary.get(_service_key("processing-store")) == "false"
    assert secondary.get(_service_key("processing-locks")) == "true"


@override_options({"backpressure.status_ttl": 60})
def test_record_consumer_health_secondary_failure_does_not_affect_others() -> None:
    clusters = {
        **options.get("redis.clusters"),
        # Nothing listens on port 1, so each write gets a connection error.
        "bp-unreachable": {
            "hosts": {0: {"host": "127.0.0.1", "port": 1}},
            "client_args": {"socket_timeout": 0.5},
        },
    }
    secondary = redis.redis_clusters.get("cluster")
    secondary.delete(*HEALTH_KEYS)

    with (
        override_options({"redis.clusters": clusters}),
        override_settings(
            SENTRY_SERVICE_MONITORING_REDIS_SECONDARY_CLUSTERS=[
                "bp-unreachable",
                "bp-not-configured",
                "cluster",
            ]
        ),
        mock.patch("sentry.processing.backpressure.health.metrics.incr") as incr,
    ):
        record_consumer_health(HEALTHY_SERVICES)
        wait_for_secondary_write()

    for key in HEALTH_KEYS:
        assert service_monitoring_cluster.get(key) == "true"
        assert secondary.get(key) == "true"
    assert incr.call_args_list == [
        mock.call(
            "backpressure.monitor.secondary_write.failed", tags={"cluster": "bp-unreachable"}
        ),
        mock.call(
            "backpressure.monitor.secondary_write.failed", tags={"cluster": "bp-not-configured"}
        ),
    ]


@override_options({"backpressure.status_ttl": 60})
def test_record_consumer_health_hung_secondary_does_not_block() -> None:
    # The secondary is a Redis Cluster client whose write hangs until released, like a node
    # that accepts the connection but does not answer.
    secondary = redis.redis_clusters.get("cluster")
    secondary.delete(*HEALTH_KEYS)
    release = threading.Event()

    def write(cluster, health_values, key_ttl):
        if cluster is secondary:
            release.wait(timeout=10)
        _write_health_values(cluster, health_values, key_ttl)

    try:
        with (
            override_settings(SENTRY_SERVICE_MONITORING_REDIS_SECONDARY_CLUSTERS=["cluster"]),
            mock.patch(
                "sentry.processing.backpressure.health._write_health_values", side_effect=write
            ),
            mock.patch("sentry.processing.backpressure.health.metrics.incr") as incr,
        ):
            service_monitoring_cluster.delete(*HEALTH_KEYS)
            start = time.monotonic()
            record_consumer_health(HEALTHY_SERVICES)
            assert time.monotonic() - start < 2
            for key in HEALTH_KEYS:
                assert service_monitoring_cluster.get(key) == "true"

            # Next loop: the secondary write still hangs, so the primary is written again and
            # the secondary write is skipped, not queued.
            service_monitoring_cluster.delete(*HEALTH_KEYS)
            start = time.monotonic()
            record_consumer_health(HEALTHY_SERVICES)
            assert time.monotonic() - start < 2
            for key in HEALTH_KEYS:
                assert service_monitoring_cluster.get(key) == "true"
            assert incr.call_args_list == [
                mock.call("backpressure.monitor.secondary_write.skipped")
            ]

            release.set()
            wait_for_secondary_write()
    finally:
        release.set()

    for key in HEALTH_KEYS:
        assert secondary.get(key) == "true"
