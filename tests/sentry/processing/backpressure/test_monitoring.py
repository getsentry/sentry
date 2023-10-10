import pytest
from django.test.utils import override_settings

from sentry.processing.backpressure.health import is_consumer_healthy, record_consumer_health
from sentry.processing.backpressure.monitor import (
    Redis,
    assert_all_services_defined,
    check_service_health,
    load_service_definitions,
)
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
                "attachments-store": None,
                "processing-store": None,
                "processing-locks": None,
                "post-process-locks": None,
            }
        )


def test_check_redis_health() -> None:
    _, cluster, _ = redis.get_dynamic_cluster_from_options(
        setting="tess", config={"cluster": "default"}
    )
    services = {"redis": Redis(cluster)}

    with override_options(
        {
            "backpressure.high_watermarks.redis": 1.0,
        }
    ):
        service_health = check_service_health(services)
        assert service_health["redis"] is True

    with override_options(
        {
            # NOTE: the default cluster for local testing will return *some* kind of used and available memory
            "backpressure.high_watermarks.redis": 0.0,
        }
    ):
        service_health = check_service_health(services)
        assert service_health["redis"] is False


@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.status_ttl": 60,
    }
)
def test_record_consumer_health() -> None:
    service_health = {
        "celery": True,
        "attachments-store": True,
        "processing-store": True,
        "processing-locks": True,
        "post-process-locks": True,
    }
    record_consumer_health(service_health)
    assert is_consumer_healthy() is True

    service_health["celery"] = False
    record_consumer_health(service_health)
    assert is_consumer_healthy() is False

    with pytest.raises(KeyError):
        record_consumer_health(
            {
                "sellerie": True,  # oops
                "attachments-store": True,
                "processing-store": True,
                "processing-locks": True,
                "post-process-locks": True,
            }
        )
