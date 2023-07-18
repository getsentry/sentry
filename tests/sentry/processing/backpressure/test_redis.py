from django.test.utils import override_settings

from sentry.processing.backpressure.memory import iter_cluster_memory_usage
from sentry.processing.backpressure.monitor import load_service_definitions


def test_returns_some_usage() -> None:
    with override_settings(SENTRY_PROCESSING_SERVICES={"redis": {"redis": "default"}}):
        services = load_service_definitions()

    usage = [usage for usage in iter_cluster_memory_usage(services["redis"].cluster)]
    assert len(usage) > 0
    memory = usage[0]
    assert memory.used > 0
    assert memory.available > 0
    assert 0.0 < memory.percentage < 1.0
