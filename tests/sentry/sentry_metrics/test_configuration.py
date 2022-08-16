import pytest

from sentry.sentry_metrics.configuration import (
    RELEASE_HEALTH_PG_NAMESPACE,
    MetricsIngestConfiguration,
    UseCaseKey,
    _register_ingest_config,
    get_ingest_config,
)


def test_unique_namespaces() -> None:
    get_ingest_config(UseCaseKey.RELEASE_HEALTH)
    with pytest.raises(AssertionError):
        _register_ingest_config(
            MetricsIngestConfiguration(
                input_topic="input-topic",
                output_topic="output-topic",
                use_case_id=UseCaseKey.RELEASE_HEALTH,
                internal_metrics_tag="release-health",
                writes_limiter_cluster_options={},
                writes_limiter_namespace=RELEASE_HEALTH_PG_NAMESPACE,
            )
        )
