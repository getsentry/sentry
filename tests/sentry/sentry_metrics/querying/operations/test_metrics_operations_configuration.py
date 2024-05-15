from sentry.sentry_metrics.querying.operations import MetricsOperationsConfig
from sentry.sentry_metrics.querying.operations.available_operations import (
    OP_COUNTERS_MIN_TIMESTAMP,
    OP_COUNTERS_SUM,
)
from sentry.snuba.dataset import EntityKey


def test_basic_setup() -> None:
    config = MetricsOperationsConfig()
    assert len(config.enabled_classes) == 1
    assert config.enabled_classes[0] == "general"


def test_add_enabled_classes() -> None:
    config = MetricsOperationsConfig()
    assert len(config.enabled_classes) == 1
    assert config.enabled_classes[0] == "general"

    config.enable_class("percentile")

    assert len(config.enabled_classes) == 2
    assert config.enabled_classes == ["general", "percentile"]


def test_get_enabled_operations() -> None:
    config = MetricsOperationsConfig()
    config.register(OP_COUNTERS_SUM)
    config.register(OP_COUNTERS_MIN_TIMESTAMP)

    assert config[EntityKey.GenericMetricsDistributions] == []
    assert config[EntityKey.GenericMetricsCounters] == [
        OP_COUNTERS_SUM.name,
    ]


def test_get_enabled_operations_with_enabled_class() -> None:
    config = MetricsOperationsConfig()
    config.register(OP_COUNTERS_SUM)
    config.register(OP_COUNTERS_MIN_TIMESTAMP)
    config.enable_class("timestamp")

    assert config[EntityKey.GenericMetricsDistributions] == []
    assert config[EntityKey.GenericMetricsCounters] == [
        OP_COUNTERS_SUM.name,
        OP_COUNTERS_MIN_TIMESTAMP.name,
    ]


def test_enable_class_is_idempotent() -> None:
    config = MetricsOperationsConfig()
    config.register(OP_COUNTERS_SUM)
    config.register(OP_COUNTERS_MIN_TIMESTAMP)
    config.enable_class("timestamp")
    config.enable_class("timestamp")

    assert config[EntityKey.GenericMetricsDistributions] == []
    assert config[EntityKey.GenericMetricsCounters] == [
        OP_COUNTERS_SUM.name,
        OP_COUNTERS_MIN_TIMESTAMP.name,
    ]


def test_get_enabled_operations_with_disabled_class() -> None:
    config = MetricsOperationsConfig()
    config.register(OP_COUNTERS_SUM)
    config.register(OP_COUNTERS_MIN_TIMESTAMP)
    config.enable_class("timestamp")
    config.disable_class("general")

    assert config[EntityKey.GenericMetricsDistributions] == []
    assert config[EntityKey.GenericMetricsCounters] == [
        OP_COUNTERS_MIN_TIMESTAMP.name,
    ]
