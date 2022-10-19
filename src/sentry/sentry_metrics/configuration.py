# Note: It must be possible to import this module directly without having to
# initialize Sentry. I.e., opening a bare python shell and typing `import
# sentry.sentry_metrics.configuration` should work.
#
# If not, the parallel indexer breaks.
from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping, MutableMapping, Optional, Tuple

import sentry_sdk
from arroyo import configure_metrics


class UseCaseKey(Enum):
    RELEASE_HEALTH = "release-health"
    PERFORMANCE = "performance"


# Rate limiter namespaces, the postgres (PG)
# values are the same as UseCaseKey to keep
# backwards compatibility
RELEASE_HEALTH_PG_NAMESPACE = "releasehealth"
PERFORMANCE_PG_NAMESPACE = "performance"
RELEASE_HEALTH_CS_NAMESPACE = "releasehealth.cs"
PERFORMANCE_CS_NAMESPACE = "performance.cs"


class IndexerStorage(Enum):
    CLOUDSPANNER = "cloudspanner"
    POSTGRES = "postgres"
    MOCK = "mock"


@dataclass(frozen=True)
class MetricsIngestConfiguration:
    db_backend: IndexerStorage
    db_backend_options: Mapping[str, Any]
    input_topic: str
    output_topic: str
    use_case_id: UseCaseKey
    internal_metrics_tag: Optional[str]
    writes_limiter_cluster_options: Mapping[str, Any]
    writes_limiter_namespace: str
    cardinality_limiter_cluster_options: Mapping[str, Any]
    cardinality_limiter_namespace: str
    index_tag_values_option_name: Optional[str] = None


_METRICS_INGEST_CONFIG_BY_USE_CASE: MutableMapping[
    Tuple[UseCaseKey, IndexerStorage], MetricsIngestConfiguration
] = dict()


def _register_ingest_config(config: MetricsIngestConfiguration) -> None:
    _METRICS_INGEST_CONFIG_BY_USE_CASE[(config.use_case_id, config.db_backend)] = config


def get_ingest_config(
    use_case_key: UseCaseKey, db_backend: IndexerStorage
) -> MetricsIngestConfiguration:
    if len(_METRICS_INGEST_CONFIG_BY_USE_CASE) == 0:
        from django.conf import settings

        _register_ingest_config(
            MetricsIngestConfiguration(
                db_backend=IndexerStorage.POSTGRES,
                db_backend_options={},
                input_topic=settings.KAFKA_INGEST_METRICS,
                output_topic=settings.KAFKA_SNUBA_METRICS,
                use_case_id=UseCaseKey.RELEASE_HEALTH,
                internal_metrics_tag="release-health",
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS,
                writes_limiter_namespace=RELEASE_HEALTH_PG_NAMESPACE,
                cardinality_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_CARDINALITY_LIMITER_OPTIONS,
                cardinality_limiter_namespace=RELEASE_HEALTH_PG_NAMESPACE,
            )
        )

        _register_ingest_config(
            MetricsIngestConfiguration(
                db_backend=IndexerStorage.POSTGRES,
                db_backend_options={},
                input_topic=settings.KAFKA_INGEST_PERFORMANCE_METRICS,
                output_topic=settings.KAFKA_SNUBA_GENERIC_METRICS,
                use_case_id=UseCaseKey.PERFORMANCE,
                internal_metrics_tag="perf",
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS_PERFORMANCE,
                writes_limiter_namespace=PERFORMANCE_PG_NAMESPACE,
                cardinality_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_CARDINALITY_LIMITER_OPTIONS_PERFORMANCE,
                cardinality_limiter_namespace=PERFORMANCE_PG_NAMESPACE,
                index_tag_values_option_name="sentry-metrics.performance.index-tag-values",
            )
        )

        _register_ingest_config(
            MetricsIngestConfiguration(
                db_backend=IndexerStorage.CLOUDSPANNER,
                # todo: set cloudspanner options of db and instance ids
                db_backend_options=settings.SENTRY_METRICS_INDEXER_SPANNER_OPTIONS,
                input_topic=settings.KAFKA_INGEST_METRICS,
                output_topic=settings.KAFKA_SNUBA_GENERICS_METRICS_CS,
                use_case_id=UseCaseKey.RELEASE_HEALTH,
                internal_metrics_tag="release-health-spanner",
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS,
                writes_limiter_namespace=RELEASE_HEALTH_CS_NAMESPACE,
                cardinality_limiter_cluster_options={},
                cardinality_limiter_namespace=RELEASE_HEALTH_PG_NAMESPACE,
            )
        )

        _register_ingest_config(
            MetricsIngestConfiguration(
                db_backend=IndexerStorage.CLOUDSPANNER,
                # todo: set cloudspanner options of db and instance ids
                db_backend_options=settings.SENTRY_METRICS_INDEXER_SPANNER_OPTIONS,
                input_topic=settings.KAFKA_INGEST_PERFORMANCE_METRICS,
                output_topic=settings.KAFKA_SNUBA_GENERICS_METRICS_CS,
                use_case_id=UseCaseKey.PERFORMANCE,
                internal_metrics_tag="perf-spanner",
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS_PERFORMANCE,
                writes_limiter_namespace=PERFORMANCE_CS_NAMESPACE,
                cardinality_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_CARDINALITY_LIMITER_OPTIONS_PERFORMANCE,
                cardinality_limiter_namespace=PERFORMANCE_PG_NAMESPACE,
            )
        )

    if db_backend == IndexerStorage.MOCK:
        _register_ingest_config(
            MetricsIngestConfiguration(
                db_backend=IndexerStorage.MOCK,
                db_backend_options={},
                input_topic="topic",
                output_topic="output-topic",
                use_case_id=use_case_key,
                internal_metrics_tag="release-health",
                writes_limiter_cluster_options={},
                writes_limiter_namespace="test-namespace",
                cardinality_limiter_cluster_options={},
                cardinality_limiter_namespace=RELEASE_HEALTH_PG_NAMESPACE,
            )
        )

    return _METRICS_INGEST_CONFIG_BY_USE_CASE[(use_case_key, db_backend)]


def initialize_sentry_and_global_consumer_state(config: MetricsIngestConfiguration) -> None:
    """
    Initialization function for subprocesses spawned by the parallel indexer.

    It does the same thing as `initialize_global_consumer_state` except it
    initializes the Sentry Django app from scratch as well.

    `config` is pickleable, and this function lives in a module that can be
    imported without any upfront initialization of the Django app. Meaning that
    an object like
    `functools.partial(initialize_sentry_and_global_consumer_state, config)` is
    pickleable as well (which we pass as initialization callback to arroyo).
    """
    from sentry.runner import configure

    configure()

    initialize_global_consumer_state(config)


def initialize_global_consumer_state(config: MetricsIngestConfiguration) -> None:
    """
    Initialization function for the main process of the metrics indexer.

    This primarily sets global tags for instrumentation in both our
    statsd/metrics usage and the Sentry SDK.
    """

    sentry_sdk.set_tag("sentry_metrics.use_case_key", config.use_case_id.value)

    from sentry.utils.metrics import add_global_tags, backend

    global_tag_map = {"pipeline": config.internal_metrics_tag or ""}

    add_global_tags(_all_threads=True, **global_tag_map)

    from sentry.sentry_metrics.metrics_wrapper import MetricsWrapper

    metrics_wrapper = MetricsWrapper(backend, name="sentry_metrics.indexer", tags=global_tag_map)
    configure_metrics(metrics_wrapper)
