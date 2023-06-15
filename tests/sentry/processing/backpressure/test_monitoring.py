import pytest
from django.test.utils import override_settings

from sentry.processing.backpressure.health import is_consumer_healthy, record_consumer_heath
from sentry.processing.backpressure.monitor import (
    Redis,
    check_service_health,
    load_service_definitions,
)
from sentry.testutils.helpers.options import override_options
from sentry.utils import redis


def test_loading_definitions() -> None:
    with override_settings(SENTRY_PROCESSING_SERVICES={"redis": {"redis": "default"}}):
        services = load_service_definitions()
        assert "redis" in services


def test_check_redis_health() -> None:
    cluster = redis.redis_clusters.get("default")
    services = {"redis": Redis(cluster)}

    with override_options(
        {
            "backpressure.high_watermarks": {"redis": 1.0},
        }
    ):
        service_health = check_service_health(services)
        assert service_health["redis"] is True

    with override_options(
        {
            # NOTE: the default cluster for local testing will return *some* kind of used and available memory
            "backpressure.high_watermarks": {"redis": 0.0},
        }
    ):
        service_health = check_service_health(services)
        assert service_health["redis"] is False


@pytest.mark.django_db()
def test_record_consumer_health() -> None:
    service_health = {"celery": True}
    record_consumer_heath(service_health)
    with override_options(
        {
            "backpressure.checking_enabled": True,
        }
    ):
        assert is_consumer_healthy() is True

    service_health = {"celery": False}
    record_consumer_heath(service_health)
    with override_options(
        {
            "backpressure.checking_enabled": True,
        }
    ):
        assert is_consumer_healthy() is False
