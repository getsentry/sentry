from django.test.utils import override_settings

from sentry.processing.backpressure.memory import iter_cluster_memory_usage
from sentry.processing.backpressure.monitor import (
    Redis,
    check_service_health,
    load_service_definitions,
)
from sentry.testutils.helpers.redis import use_redis_cluster


@override_settings(SENTRY_PROCESSING_SERVICES={"redis": {"redis": "default"}})
def test_rb_cluster_returns_some_usage() -> None:
    services = load_service_definitions()
    redis_service = services["redis"]
    assert isinstance(redis_service, Redis)

    usage = [usage for usage in iter_cluster_memory_usage(redis_service.cluster)]
    assert len(usage) > 0
    memory = usage[0]
    assert memory.used > 0
    assert memory.available > 0
    assert 0.0 < memory.percentage < 1.0


@use_redis_cluster()
def test_redis_cluster_cluster_returns_some_usage() -> None:
    services = load_service_definitions()
    redis_service = services["redis"]
    assert isinstance(redis_service, Redis)

    usage = [usage for usage in iter_cluster_memory_usage(redis_service.cluster)]
    assert len(usage) > 0
    memory = usage[0]
    assert memory.used > 0
    assert memory.available > 0
    assert 0.0 < memory.percentage < 1.0


@use_redis_cluster(high_watermark=100)
def test_redis_health():
    services = load_service_definitions()
    assert isinstance(services["redis"], Redis)

    unhealthy_services = check_service_health(services=services)
    redis_services = unhealthy_services.get("redis")
    assert isinstance(redis_services, list)
    assert len(redis_services) == 0


@use_redis_cluster(high_watermark=0)
def test_redis_unhealthy_state():
    services = load_service_definitions()
    assert isinstance(services["redis"], Redis)

    unhealthy_services = check_service_health(services=services)
    redis_services = unhealthy_services.get("redis")
    assert isinstance(redis_services, list)
    assert len(redis_services) == 6
