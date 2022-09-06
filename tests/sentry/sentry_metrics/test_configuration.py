from sentry.sentry_metrics.configuration import (
    _METRICS_INGEST_CONFIG_BY_USE_CASE,
    IndexerStorage,
    UseCaseKey,
    get_ingest_config,
)


def test_unique_namespaces() -> None:
    get_ingest_config(UseCaseKey.RELEASE_HEALTH, IndexerStorage.POSTGRES)
    namespaces = [
        config.writes_limiter_namespace for config in _METRICS_INGEST_CONFIG_BY_USE_CASE.values()
    ]
    assert len(namespaces) == len(set(namespaces))
