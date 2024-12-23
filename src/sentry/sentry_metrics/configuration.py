# Note: It must be possible to import this module directly without having to
# initialize Sentry. I.e., opening a bare python shell and typing `import
# sentry.sentry_metrics.configuration` should work.
#
# If not, the parallel indexer breaks.
from collections.abc import Mapping, MutableMapping
from dataclasses import dataclass
from enum import Enum
from typing import Any

import sentry_sdk

from sentry.conf.types.kafka_definition import Topic

# The maximum length of a column that is indexed in postgres. It is important to keep this in
# sync between the consumers and the models defined in src/sentry/sentry_metrics/models.py
MAX_INDEXED_COLUMN_LENGTH = 200


class UseCaseKey(Enum):
    RELEASE_HEALTH = "release-health"
    PERFORMANCE = "performance"


# Rate limiter namespaces, the postgres (PG)
# values are the same as UseCaseKey to keep
# backwards compatibility
RELEASE_HEALTH_PG_NAMESPACE = "releasehealth"
PERFORMANCE_PG_NAMESPACE = "performance"

RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME = (
    "sentry-metrics.indexer.release-health.schema-validation-rules"
)
GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME = (
    "sentry-metrics.indexer.generic-metrics.schema-validation-rules"
)


class IndexerStorage(Enum):
    POSTGRES = "postgres"
    MOCK = "mock"


@dataclass(frozen=True)
class MetricsIngestConfiguration:
    db_backend: IndexerStorage
    db_backend_options: Mapping[str, Any]
    output_topic: Topic
    use_case_id: UseCaseKey
    internal_metrics_tag: str | None
    writes_limiter_cluster_options: Mapping[str, Any]
    writes_limiter_namespace: str

    should_index_tag_values: bool
    schema_validation_rule_option_name: str | None = None
    is_output_sliced: bool | None = False


_METRICS_INGEST_CONFIG_BY_USE_CASE: MutableMapping[
    tuple[UseCaseKey, IndexerStorage], MetricsIngestConfiguration
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
                output_topic=Topic.SNUBA_METRICS,
                use_case_id=UseCaseKey.RELEASE_HEALTH,
                internal_metrics_tag="release-health",
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS,
                writes_limiter_namespace=RELEASE_HEALTH_PG_NAMESPACE,
                should_index_tag_values=True,
                schema_validation_rule_option_name=RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            )
        )

        _register_ingest_config(
            MetricsIngestConfiguration(
                db_backend=IndexerStorage.POSTGRES,
                db_backend_options={},
                output_topic=Topic.SNUBA_GENERIC_METRICS,
                use_case_id=UseCaseKey.PERFORMANCE,
                internal_metrics_tag="perf",
                writes_limiter_cluster_options=settings.SENTRY_METRICS_INDEXER_WRITES_LIMITER_OPTIONS_PERFORMANCE,
                writes_limiter_namespace=PERFORMANCE_PG_NAMESPACE,
                is_output_sliced=settings.SENTRY_METRICS_INDEXER_ENABLE_SLICED_PRODUCER,
                should_index_tag_values=False,
                schema_validation_rule_option_name=GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            )
        )

    if (use_case_key, db_backend) == (UseCaseKey.RELEASE_HEALTH, IndexerStorage.MOCK):
        _register_ingest_config(
            MetricsIngestConfiguration(
                db_backend=IndexerStorage.MOCK,
                db_backend_options={},
                output_topic=Topic.SNUBA_METRICS,
                use_case_id=use_case_key,
                internal_metrics_tag="release-health",
                writes_limiter_cluster_options={},
                writes_limiter_namespace="test-namespace-rh",
                should_index_tag_values=True,
                schema_validation_rule_option_name=RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            )
        )

    if (use_case_key, db_backend) == (UseCaseKey.PERFORMANCE, IndexerStorage.MOCK):
        _register_ingest_config(
            MetricsIngestConfiguration(
                db_backend=IndexerStorage.MOCK,
                db_backend_options={},
                output_topic=Topic.SNUBA_GENERIC_METRICS,
                use_case_id=use_case_key,
                internal_metrics_tag="perf",
                writes_limiter_cluster_options={},
                writes_limiter_namespace="test-namespace-perf",
                should_index_tag_values=False,
                schema_validation_rule_option_name=GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
            )
        )

    return _METRICS_INGEST_CONFIG_BY_USE_CASE[(use_case_key, db_backend)]


def initialize_subprocess_state(config: MetricsIngestConfiguration) -> None:
    """
    Initialization function for the subprocesses of the metrics indexer.

    `config` is pickleable, and this function lives in a module that can be
    imported without any upfront initialization of the Django app. Meaning that
    an object like
    `functools.partial(initialize_sentry_and_global_consumer_state, config)` is
    pickleable as well (which we pass as initialization callback to arroyo).

    This function should ideally be kept minimal and not contain too much
    logic. Commonly reusable bits should be added to
    sentry.utils.arroyo.run_task_with_multiprocessing.

    We already rely on sentry.utils.arroyo.run_task_with_multiprocessing to copy
    statsd tags into the subprocess, eventually we should do the same for
    Sentry tags.
    """

    sentry_sdk.set_tag("sentry_metrics.use_case_key", config.use_case_id.value)


def initialize_main_process_state(config: MetricsIngestConfiguration) -> None:
    """
    Initialization function for the main process of the metrics indexer.

    This primarily sets global tags for instrumentation in both our
    statsd/metrics usage and the Sentry SDK.
    """

    sentry_sdk.set_tag("sentry_metrics.use_case_key", config.use_case_id.value)

    from sentry.utils.metrics import add_global_tags

    global_tag_map = {"pipeline": config.internal_metrics_tag or ""}

    add_global_tags(_all_threads=True, **global_tag_map)
