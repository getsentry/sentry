import logging
from collections.abc import MutableMapping
from datetime import datetime, timezone

import pytest
import sentry_kafka_schemas
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic, Value

from sentry.sentry_metrics.aggregation_option_registry import (
    AggregationOption,
    TimeWindow,
    get_aggregation_options,
)
from sentry.sentry_metrics.configuration import (
    GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME,
    RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME,
)
from sentry.sentry_metrics.consumers.indexer.batch import IndexerBatch
from sentry.sentry_metrics.consumers.indexer.common import BrokerMeta
from sentry.sentry_metrics.consumers.indexer.processing import INGEST_CODEC
from sentry.sentry_metrics.consumers.indexer.schema_validator import MetricsSchemaValidator
from sentry.sentry_metrics.consumers.indexer.tags_validator import (
    GenericMetricsTagsValidator,
    ReleaseHealthTagsValidator,
)
from sentry.sentry_metrics.indexer.base import FetchType, FetchTypeExt, Metadata
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer.mri import SessionMRI, TransactionMRI
from sentry.testutils.helpers.options import override_options
from sentry.utils import json

MOCK_METRIC_ID_AGG_OPTION = {
    "d:transactions/measurements.fcp@millisecond": {AggregationOption.HIST: TimeWindow.NINETY_DAYS},
    "d:transactions/measurements.lcp@millisecond": {AggregationOption.HIST: TimeWindow.NINETY_DAYS},
    "d:transactions/alert@none": {AggregationOption.TEN_SECOND: TimeWindow.NINETY_DAYS},
}


pytestmark = pytest.mark.sentry_metrics
BROKER_TIMESTAMP = datetime.now(tz=timezone.utc)
ts = int(datetime.now(tz=timezone.utc).timestamp())
counter_payload = {
    "name": SessionMRI.RAW_SESSION.value,
    "tags": {
        "environment": "production",
        "session.status": "init",
    },
    "timestamp": ts,
    "type": "c",
    "value": 1,
    "org_id": 1,
    "retention_days": 90,
    "project_id": 3,
}
counter_headers = [("namespace", b"sessions")]

distribution_payload = {
    "name": SessionMRI.RAW_DURATION.value,
    "tags": {
        "environment": "production",
        "session.status": "healthy",
    },
    "timestamp": ts,
    "type": "d",
    "value": [4, 5, 6],
    "org_id": 1,
    "retention_days": 90,
    "project_id": 3,
}
distribution_headers = [("namespace", b"sessions")]

set_payload = {
    "name": SessionMRI.RAW_ERROR.value,
    "tags": {
        "environment": "production",
        "session.status": "errored",
    },
    "timestamp": ts,
    "type": "s",
    "value": [3],
    "org_id": 1,
    "retention_days": 90,
    "project_id": 3,
}
set_headers = [("namespace", b"sessions")]

extracted_string_output = {
    UseCaseID.SESSIONS: {
        1: {
            "c:sessions/session@none",
            "d:sessions/duration@second",
            "environment",
            "errored",
            "healthy",
            "init",
            "production",
            "s:sessions/error@none",
            "session.status",
        }
    }
}


def _construct_messages(payloads):
    message_batch = []
    for i, (payload, headers) in enumerate(payloads):
        message_batch.append(
            Message(
                BrokerValue(
                    KafkaPayload(None, json.dumps(payload).encode("utf-8"), headers or []),
                    Partition(Topic("topic"), 0),
                    i,
                    BROKER_TIMESTAMP,
                )
            )
        )

    return message_batch


def _construct_outer_message(payloads):
    message_batch = _construct_messages(payloads)

    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]
    outer_message = Message(Value(message_batch, last.committable))
    return outer_message


def _deconstruct_messages(snuba_messages, kafka_logical_topic="snuba-metrics"):
    """
    Convert a list of messages returned by `reconstruct_messages` into python
    primitives, to run assertions on:

        assert _deconstruct_messages(batch.reconstruct_messages(...)) == [ ... ]

    This is slightly nicer to work with than:

        assert batch.reconstruct_messages(...) == _construct_messages([ ... ])

    ...because pytest's assertion diffs work better with python primitives.
    """

    rv = []

    codec = sentry_kafka_schemas.get_codec(kafka_logical_topic)

    for msg in snuba_messages:
        decoded = codec.decode(msg.payload.value, validate=True)
        rv.append((decoded, msg.payload.headers))

    return rv


def _deconstruct_routing_messages(snuba_messages):
    """
    Similar to `_deconstruct_messages`, but for routing messages.
    """
    all_messages = []
    for msg in snuba_messages:
        headers: MutableMapping[str, str] = {}
        for key, value in msg.payload.routing_header.items():
            headers.update({key: value})

        payload = json.loads(msg.payload.routing_message.value.decode("utf-8"))

        all_messages.append((headers, payload, msg.payload.routing_message.headers))

    return all_messages


def _get_string_indexer_log_records(caplog):
    """
    Get all log records and relevant extra arguments for easy snapshotting.
    """
    return [
        (
            rec.message,
            {
                k: v
                for k, v in rec.__dict__.items()
                if k
                in (
                    "string_type",
                    "is_global_quota",
                    "num_global_quotas",
                    "num_global_quotas",
                    "org_batch_size",
                )
            },
        )
        for rec in caplog.records
    ]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "should_index_tag_values, expected",
    [
        pytest.param(
            True,
            {
                UseCaseID.SESSIONS: {
                    1: {
                        "c:sessions/session@none",
                        "d:sessions/duration@second",
                        "environment",
                        "errored",
                        "healthy",
                        "init",
                        "production",
                        "s:sessions/error@none",
                        "session.status",
                    },
                }
            },
            id="index tag values true",
        ),
        pytest.param(
            False,
            {
                UseCaseID.SESSIONS: {
                    1: {
                        "c:sessions/session@none",
                        "d:sessions/duration@second",
                        "environment",
                        "s:sessions/error@none",
                        "session.status",
                    },
                }
            },
            id="index tag values false",
        ),
    ],
)
def test_extract_strings_with_rollout(should_index_tag_values, expected):
    """
    Test that the indexer batch extracts the correct strings from the messages
    based on whether tag values should be indexed or not.
    """
    outer_message = _construct_outer_message(
        [
            (counter_payload, counter_headers),
            (distribution_payload, distribution_headers),
            (set_payload, set_headers),
        ]
    )
    batch = IndexerBatch(
        outer_message,
        should_index_tag_values,
        False,
        tags_validator=ReleaseHealthTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )

    assert batch.extract_strings() == expected
    assert not batch.invalid_msg_meta


@pytest.mark.django_db
def test_extract_strings_with_multiple_use_case_ids():
    """
    Verify that the extract string method can handle payloads that has multiple
    (generic) uses cases
    """
    counter_payload = {
        "name": "c:spans/session@none",
        "tags": {
            "environment": "production",
            "session.status": "init",
        },
        "timestamp": ts,
        "type": "c",
        "value": 1,
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }

    distribution_payload = {
        "name": "d:escalating_issues/duration@second",
        "tags": {
            "environment": "production",
            "session.status": "healthy",
        },
        "timestamp": ts,
        "type": "d",
        "value": [4, 5, 6],
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }

    set_payload = {
        "name": "s:escalating_issues/error@none",
        "tags": {
            "environment": "production",
            "session.status": "errored",
        },
        "timestamp": ts,
        "type": "s",
        "value": [3],
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }

    outer_message = _construct_outer_message(
        [
            (counter_payload, [("namespace", b"spans")]),
            (distribution_payload, [("namespace", b"escalating_issues")]),
            (set_payload, [("namespace", b"escalating_issues")]),
        ]
    )
    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=GenericMetricsTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == {
        UseCaseID.SPANS: {
            1: {
                "c:spans/session@none",
                "environment",
                "production",
                "session.status",
                "init",
            }
        },
        UseCaseID.ESCALATING_ISSUES: {
            1: {
                "d:escalating_issues/duration@second",
                "environment",
                "production",
                "session.status",
                "healthy",
                "s:escalating_issues/error@none",
                "environment",
                "production",
                "session.status",
                "errored",
            }
        },
    }


@pytest.mark.django_db
@override_options({"sentry-metrics.indexer.disabled-namespaces": ["escalating_issues"]})
def test_extract_strings_with_single_use_case_ids_blocked():
    """
    Verify that the extract string method will work normally when a single use case ID is blocked
    """
    counter_payload = {
        "name": "c:spans/session@none",
        "tags": {
            "environment": "production",
            "session.status": "init",
        },
        "timestamp": ts,
        "type": "c",
        "value": 1,
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }

    distribution_payload = {
        "name": "d:escalating_issues/duration@second",
        "tags": {
            "environment": "production",
            "session.status": "healthy",
        },
        "timestamp": ts,
        "type": "d",
        "value": [4, 5, 6],
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }

    set_payload = {
        "name": "s:escalating_issues/error@none",
        "tags": {
            "environment": "production",
            "session.status": "errored",
        },
        "timestamp": ts,
        "type": "s",
        "value": [3],
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }

    outer_message = _construct_outer_message(
        [
            (counter_payload, [("namespace", b"spans")]),
            (distribution_payload, [("namespace", b"escalating_issues")]),
            (set_payload, [("namespace", b"escalating_issues")]),
        ]
    )
    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=GenericMetricsTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == {
        UseCaseID.SPANS: {
            1: {
                "c:spans/session@none",
                "environment",
                "production",
                "session.status",
                "init",
            }
        }
    }
    assert not batch.invalid_msg_meta


@pytest.mark.django_db
@override_options({"sentry-metrics.indexer.disabled-namespaces": ["spans", "escalating_issues"]})
def test_extract_strings_with_multiple_use_case_ids_blocked():
    """
    Verify that the extract string method will work normally when multiple use case IDs are blocked
    """
    custom_uc_counter_payload = {
        "name": "c:spans/session@none",
        "tags": {
            "environment": "production",
            "session.status": "init",
        },
        "timestamp": ts,
        "type": "c",
        "value": 1,
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }
    perf_distribution_payload = {
        "name": TransactionMRI.MEASUREMENTS_FCP.value,
        "tags": {
            "environment": "production",
            "session.status": "healthy",
        },
        "timestamp": ts,
        "type": "d",
        "value": [4, 5, 6],
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }
    custom_uc_set_payload = {
        "name": "s:escalating_issues/error@none",
        "tags": {
            "environment": "production",
            "session.status": "errored",
        },
        "timestamp": ts,
        "type": "s",
        "value": [3],
        "org_id": 2,
        "retention_days": 90,
        "project_id": 3,
    }

    outer_message = _construct_outer_message(
        [
            (custom_uc_counter_payload, [("namespace", b"spans")]),
            (perf_distribution_payload, [("namespace", b"transactions")]),
            (custom_uc_set_payload, [("namespace", b"escalating_issues")]),
        ]
    )
    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=GenericMetricsTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == {
        UseCaseID.TRANSACTIONS: {
            1: {
                TransactionMRI.MEASUREMENTS_FCP.value,
                "environment",
                "production",
                "session.status",
                "healthy",
            }
        },
    }
    assert not batch.invalid_msg_meta


@pytest.mark.django_db
def test_extract_strings_with_invalid_mri():
    """
    Verify that extract strings will drop payload that has invalid MRI in name field but continue processing the rest
    """
    bad_counter_payload = {
        "name": "invalid_MRI",
        "tags": {
            "environment": "production",
            "session.status": "init",
        },
        "timestamp": ts,
        "type": "c",
        "value": 1,
        "org_id": 100,
        "retention_days": 90,
        "project_id": 3,
    }
    counter_payload = {
        "name": "c:spans/session@none",
        "tags": {
            "environment": "production",
            "session.status": "init",
        },
        "timestamp": ts,
        "type": "c",
        "value": 1,
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }

    distribution_payload = {
        "name": "d:escalating_issues/duration@second",
        "tags": {
            "environment": "production",
            "session.status": "healthy",
        },
        "timestamp": ts,
        "type": "d",
        "value": [4, 5, 6],
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }

    set_payload = {
        "name": "s:escalating_issues/error@none",
        "tags": {
            "environment": "production",
            "session.status": "errored",
        },
        "timestamp": ts,
        "type": "s",
        "value": [3],
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }

    outer_message = _construct_outer_message(
        [
            (bad_counter_payload, [("namespace", b"")]),
            (counter_payload, [("namespace", b"spans")]),
            (distribution_payload, [("namespace", b"escalating_issues")]),
            (set_payload, [("namespace", b"escalating_issues")]),
        ]
    )
    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=GenericMetricsTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == {
        UseCaseID.SPANS: {
            1: {
                "c:spans/session@none",
                "environment",
                "production",
                "session.status",
                "init",
            }
        },
        UseCaseID.ESCALATING_ISSUES: {
            1: {
                "d:escalating_issues/duration@second",
                "environment",
                "production",
                "session.status",
                "healthy",
                "s:escalating_issues/error@none",
                "environment",
                "production",
                "session.status",
                "errored",
            }
        },
    }
    assert batch.invalid_msg_meta == {BrokerMeta(Partition(Topic("topic"), 0), 0)}


@pytest.mark.django_db
def test_extract_strings_with_multiple_use_case_ids_and_org_ids():
    """
    Verify that the extract string method can handle payloads that has multiple
    (generic) uses cases and from different orgs
    """

    custom_uc_counter_payload = {
        "name": "c:spans/session@none",
        "tags": {
            "environment": "production",
            "session.status": "init",
        },
        "timestamp": ts,
        "type": "c",
        "value": 1,
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }
    perf_distribution_payload = {
        "name": TransactionMRI.MEASUREMENTS_FCP.value,
        "tags": {
            "environment": "production",
            "session.status": "healthy",
        },
        "timestamp": ts,
        "type": "d",
        "value": [4, 5, 6],
        "org_id": 1,
        "retention_days": 90,
        "project_id": 3,
    }
    custom_uc_set_payload = {
        "name": "s:spans/error@none",
        "tags": {
            "environment": "production",
            "session.status": "errored",
        },
        "timestamp": ts,
        "type": "s",
        "value": [3],
        "org_id": 2,
        "retention_days": 90,
        "project_id": 3,
    }

    outer_message = _construct_outer_message(
        [
            (custom_uc_counter_payload, [("namespace", b"spans")]),
            (perf_distribution_payload, [("namespace", b"transactions")]),
            (custom_uc_set_payload, [("namespace", b"spans")]),
        ]
    )
    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=GenericMetricsTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, GENERIC_METRICS_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == {
        UseCaseID.SPANS: {
            1: {
                "c:spans/session@none",
                "environment",
                "production",
                "session.status",
                "init",
            },
            2: {
                "s:spans/error@none",
                "environment",
                "production",
                "session.status",
                "errored",
            },
        },
        UseCaseID.TRANSACTIONS: {
            1: {
                TransactionMRI.MEASUREMENTS_FCP.value,
                "environment",
                "production",
                "session.status",
                "healthy",
            }
        },
    }
    assert not batch.invalid_msg_meta


@pytest.mark.django_db
def test_all_resolved(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, counter_headers),
            (distribution_payload, distribution_headers),
            (set_payload, set_headers),
        ]
    )

    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=ReleaseHealthTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == (
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none",
                    "d:sessions/duration@second",
                    "environment",
                    "errored",
                    "healthy",
                    "init",
                    "production",
                    "s:sessions/error@none",
                    "session.status",
                }
            }
        }
    )
    assert not batch.invalid_msg_meta

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": 1,
                    "d:sessions/duration@second": 2,
                    "environment": 3,
                    "errored": 4,
                    "healthy": 5,
                    "init": 6,
                    "production": 7,
                    "s:sessions/error@none": 8,
                    "session.status": 9,
                }
            }
        },
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                    "d:sessions/duration@second": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                    "environment": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                    "errored": Metadata(id=4, fetch_type=FetchType.DB_READ),
                    "healthy": Metadata(id=5, fetch_type=FetchType.HARDCODED),
                    "init": Metadata(id=6, fetch_type=FetchType.HARDCODED),
                    "production": Metadata(id=7, fetch_type=FetchType.CACHE_HIT),
                    "s:sessions/error@none": Metadata(id=8, fetch_type=FetchType.CACHE_HIT),
                    "session.status": Metadata(id=9, fetch_type=FetchType.CACHE_HIT),
                }
            },
        },
    ).data

    assert _get_string_indexer_log_records(caplog) == []

    assert _deconstruct_messages(snuba_payloads) == [
        (
            {
                "mapping_meta": {
                    "c": {
                        "1": "c:sessions/session@none",
                        "3": "environment",
                        "7": "production",
                        "9": "session.status",
                    },
                    "h": {"6": "init"},
                },
                "metric_id": 1,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 6},
                "timestamp": ts,
                "type": "c",
                "use_case_id": "sessions",
                "value": 1.0,
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [*counter_headers, ("mapping_sources", b"ch"), ("metric_type", "c")],
        ),
        (
            {
                "mapping_meta": {
                    "c": {
                        "2": "d:sessions/duration@second",
                        "3": "environment",
                        "7": "production",
                        "9": "session.status",
                    },
                    "h": {"5": "healthy"},
                },
                "metric_id": 2,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 5},
                "timestamp": ts,
                "type": "d",
                "use_case_id": "sessions",
                "value": [4, 5, 6],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [*distribution_headers, ("mapping_sources", b"ch"), ("metric_type", "d")],
        ),
        (
            {
                "mapping_meta": {
                    "c": {
                        "3": "environment",
                        "7": "production",
                        "8": "s:sessions/error@none",
                        "9": "session.status",
                    },
                    "d": {"4": "errored"},
                },
                "metric_id": 8,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 4},
                "timestamp": ts,
                "type": "s",
                "use_case_id": "sessions",
                "value": [3],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [*set_headers, ("mapping_sources", b"cd"), ("metric_type", "s")],
        ),
    ]


@pytest.mark.django_db
def test_all_resolved_with_routing_information(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, counter_headers),
            (distribution_payload, distribution_headers),
            (set_payload, set_headers),
        ]
    )

    batch = IndexerBatch(
        outer_message,
        True,
        True,
        tags_validator=ReleaseHealthTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == (
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none",
                    "d:sessions/duration@second",
                    "environment",
                    "errored",
                    "healthy",
                    "init",
                    "production",
                    "s:sessions/error@none",
                    "session.status",
                }
            }
        }
    )

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": 1,
                    "d:sessions/duration@second": 2,
                    "environment": 3,
                    "errored": 4,
                    "healthy": 5,
                    "init": 6,
                    "production": 7,
                    "s:sessions/error@none": 8,
                    "session.status": 9,
                }
            }
        },
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                    "d:sessions/duration@second": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                    "environment": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                    "errored": Metadata(id=4, fetch_type=FetchType.DB_READ),
                    "healthy": Metadata(id=5, fetch_type=FetchType.HARDCODED),
                    "init": Metadata(id=6, fetch_type=FetchType.HARDCODED),
                    "production": Metadata(id=7, fetch_type=FetchType.CACHE_HIT),
                    "s:sessions/error@none": Metadata(id=8, fetch_type=FetchType.CACHE_HIT),
                    "session.status": Metadata(id=9, fetch_type=FetchType.CACHE_HIT),
                }
            }
        },
    ).data

    assert _get_string_indexer_log_records(caplog) == []
    assert _deconstruct_routing_messages(snuba_payloads) == [
        (
            {"org_id": 1},
            {
                "mapping_meta": {
                    "c": {
                        "1": "c:sessions/session@none",
                        "3": "environment",
                        "7": "production",
                        "9": "session.status",
                    },
                    "h": {"6": "init"},
                },
                "metric_id": 1,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 6},
                "timestamp": ts,
                "type": "c",
                "use_case_id": "sessions",
                "value": 1.0,
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [*counter_headers, ("mapping_sources", b"ch"), ("metric_type", "c")],
        ),
        (
            {"org_id": 1},
            {
                "mapping_meta": {
                    "c": {
                        "2": "d:sessions/duration@second",
                        "3": "environment",
                        "7": "production",
                        "9": "session.status",
                    },
                    "h": {"5": "healthy"},
                },
                "metric_id": 2,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 5},
                "timestamp": ts,
                "type": "d",
                "use_case_id": "sessions",
                "value": [4, 5, 6],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [
                *distribution_headers,
                ("mapping_sources", b"ch"),
                ("metric_type", "d"),
            ],
        ),
        (
            {"org_id": 1},
            {
                "mapping_meta": {
                    "c": {
                        "3": "environment",
                        "7": "production",
                        "8": "s:sessions/error@none",
                        "9": "session.status",
                    },
                    "d": {"4": "errored"},
                },
                "metric_id": 8,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 4},
                "timestamp": ts,
                "type": "s",
                "use_case_id": "sessions",
                "value": [3],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [*set_headers, ("mapping_sources", b"cd"), ("metric_type", "s")],
        ),
    ]


@pytest.mark.django_db
def test_all_resolved_retention_days_honored(caplog, settings):
    """
    Tests that the indexer batch honors the incoming retention_days values
    from Relay or falls back to 90.
    """

    distribution_payload_modified = distribution_payload.copy()
    distribution_payload_modified["retention_days"] = 30

    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, counter_headers),
            (distribution_payload_modified, distribution_headers),
            (set_payload, set_headers),
        ]
    )

    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=ReleaseHealthTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == (
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none",
                    "d:sessions/duration@second",
                    "environment",
                    "errored",
                    "healthy",
                    "init",
                    "production",
                    "s:sessions/error@none",
                    "session.status",
                }
            }
        }
    )
    assert not batch.invalid_msg_meta

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": 1,
                    "d:sessions/duration@second": 2,
                    "environment": 3,
                    "errored": 4,
                    "healthy": 5,
                    "init": 6,
                    "production": 7,
                    "s:sessions/error@none": 8,
                    "session.status": 9,
                }
            }
        },
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                    "d:sessions/duration@second": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                    "environment": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                    "errored": Metadata(id=4, fetch_type=FetchType.DB_READ),
                    "healthy": Metadata(id=5, fetch_type=FetchType.HARDCODED),
                    "init": Metadata(id=6, fetch_type=FetchType.HARDCODED),
                    "production": Metadata(id=7, fetch_type=FetchType.CACHE_HIT),
                    "s:sessions/error@none": Metadata(id=8, fetch_type=FetchType.CACHE_HIT),
                    "session.status": Metadata(id=9, fetch_type=FetchType.CACHE_HIT),
                }
            }
        },
    ).data

    assert _get_string_indexer_log_records(caplog) == []
    assert _deconstruct_messages(snuba_payloads) == [
        (
            {
                "mapping_meta": {
                    "c": {
                        "1": "c:sessions/session@none",
                        "3": "environment",
                        "7": "production",
                        "9": "session.status",
                    },
                    "h": {"6": "init"},
                },
                "metric_id": 1,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 6},
                "timestamp": ts,
                "type": "c",
                "use_case_id": "sessions",
                "value": 1.0,
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [*counter_headers, ("mapping_sources", b"ch"), ("metric_type", "c")],
        ),
        (
            {
                "mapping_meta": {
                    "c": {
                        "2": "d:sessions/duration@second",
                        "3": "environment",
                        "7": "production",
                        "9": "session.status",
                    },
                    "h": {"5": "healthy"},
                },
                "metric_id": 2,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 30,
                "tags": {"3": 7, "9": 5},
                "timestamp": ts,
                "type": "d",
                "use_case_id": "sessions",
                "value": [4, 5, 6],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [*distribution_headers, ("mapping_sources", b"ch"), ("metric_type", "d")],
        ),
        (
            {
                "mapping_meta": {
                    "c": {
                        "3": "environment",
                        "7": "production",
                        "8": "s:sessions/error@none",
                        "9": "session.status",
                    },
                    "d": {"4": "errored"},
                },
                "metric_id": 8,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 4},
                "timestamp": ts,
                "type": "s",
                "use_case_id": "sessions",
                "value": [3],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [*set_headers, ("mapping_sources", b"cd"), ("metric_type", "s")],
        ),
    ]


@pytest.mark.django_db
def test_batch_resolve_with_values_not_indexed(caplog, settings):
    """
    Tests that the indexer batch skips resolving tag values for indexing and
    sends the raw tag value to Snuba.

    The difference between this test and test_all_resolved is that the tag values are
    strings instead of integers. Because of that indexed tag keys are
    different and mapping_meta is smaller. The payload also contains the
    version field to specify that the tag values are not indexed.
    """
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, counter_headers),
            (distribution_payload, distribution_headers),
            (set_payload, set_headers),
        ]
    )

    batch = IndexerBatch(
        outer_message,
        False,
        False,
        tags_validator=ReleaseHealthTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == (
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none",
                    "d:sessions/duration@second",
                    "environment",
                    "s:sessions/error@none",
                    "session.status",
                }
            }
        }
    )
    assert not batch.invalid_msg_meta

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": 1,
                    "d:sessions/duration@second": 2,
                    "environment": 3,
                    "s:sessions/error@none": 4,
                    "session.status": 5,
                }
            }
        },
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                    "d:sessions/duration@second": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                    "environment": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                    "s:sessions/error@none": Metadata(id=4, fetch_type=FetchType.CACHE_HIT),
                    "session.status": Metadata(id=5, fetch_type=FetchType.CACHE_HIT),
                }
            }
        },
    ).data

    assert _get_string_indexer_log_records(caplog) == []
    assert _deconstruct_messages(snuba_payloads, kafka_logical_topic="snuba-generic-metrics") == [
        (
            {
                "version": 2,
                "mapping_meta": {
                    "c": {
                        "1": "c:sessions/session@none",
                        "3": "environment",
                        "5": "session.status",
                    },
                },
                "metric_id": 1,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": "production", "5": "init"},
                "timestamp": ts,
                "type": "c",
                "use_case_id": "sessions",
                "value": 1.0,
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [*counter_headers, ("mapping_sources", b"c"), ("metric_type", "c")],
        ),
        (
            {
                "version": 2,
                "mapping_meta": {
                    "c": {
                        "2": "d:sessions/duration@second",
                        "3": "environment",
                        "5": "session.status",
                    },
                },
                "metric_id": 2,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": "production", "5": "healthy"},
                "timestamp": ts,
                "type": "d",
                "use_case_id": "sessions",
                "value": [4, 5, 6],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [
                *distribution_headers,
                ("mapping_sources", b"c"),
                ("metric_type", "d"),
            ],
        ),
        (
            {
                "version": 2,
                "mapping_meta": {
                    "c": {
                        "3": "environment",
                        "4": "s:sessions/error@none",
                        "5": "session.status",
                    },
                },
                "metric_id": 4,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": "production", "5": "errored"},
                "timestamp": ts,
                "type": "s",
                "use_case_id": "sessions",
                "value": [3],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [
                *set_headers,
                ("mapping_sources", b"c"),
                ("metric_type", "s"),
            ],
        ),
    ]


@pytest.mark.django_db
def test_metric_id_rate_limited(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, counter_headers),
            (distribution_payload, distribution_headers),
            (set_payload, set_headers),
        ]
    )

    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=ReleaseHealthTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == (
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none",
                    "d:sessions/duration@second",
                    "environment",
                    "errored",
                    "healthy",
                    "init",
                    "production",
                    "s:sessions/error@none",
                    "session.status",
                }
            }
        }
    )
    assert not batch.invalid_msg_meta

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": None,
                    "d:sessions/duration@second": None,
                    "environment": 3,
                    "errored": 4,
                    "healthy": 5,
                    "init": 6,
                    "production": 7,
                    "s:sessions/error@none": 8,
                    "session.status": 9,
                }
            }
        },
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": Metadata(
                        id=None,
                        fetch_type=FetchType.RATE_LIMITED,
                        fetch_type_ext=FetchTypeExt(is_global=False),
                    ),
                    "d:sessions/duration@second": Metadata(
                        id=None, fetch_type=FetchType.RATE_LIMITED, fetch_type_ext=None
                    ),
                    "environment": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                    "errored": Metadata(id=4, fetch_type=FetchType.DB_READ),
                    "healthy": Metadata(id=5, fetch_type=FetchType.HARDCODED),
                    "init": Metadata(id=6, fetch_type=FetchType.HARDCODED),
                    "production": Metadata(id=7, fetch_type=FetchType.CACHE_HIT),
                    "s:sessions/error@none": Metadata(id=None, fetch_type=FetchType.DB_READ),
                    "session.status": Metadata(id=9, fetch_type=FetchType.CACHE_HIT),
                }
            }
        },
    ).data

    assert _deconstruct_messages(snuba_payloads) == [
        (
            {
                "mapping_meta": {
                    "c": {"3": "environment", "7": "production", "9": "session.status"},
                    "d": {"4": "errored", "None": "s:sessions/error@none"},
                },
                "metric_id": 8,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 4},
                "timestamp": ts,
                "type": "s",
                "use_case_id": "sessions",
                "value": [3],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [
                *set_headers,
                ("mapping_sources", b"cd"),
                ("metric_type", "s"),
            ],
        ),
    ]

    assert _get_string_indexer_log_records(caplog) == [
        (
            "process_messages.dropped_message",
            {"org_batch_size": 9, "is_global_quota": False, "string_type": "metric_id"},
        ),
        (
            "process_messages.dropped_message",
            {"org_batch_size": 9, "is_global_quota": False, "string_type": "metric_id"},
        ),
    ]


@pytest.mark.django_db
def test_tag_key_rate_limited(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, counter_headers),
            (distribution_payload, distribution_headers),
            (set_payload, set_headers),
        ]
    )

    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=ReleaseHealthTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == (
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none",
                    "d:sessions/duration@second",
                    "environment",
                    "errored",
                    "healthy",
                    "init",
                    "production",
                    "s:sessions/error@none",
                    "session.status",
                }
            }
        }
    )
    assert not batch.invalid_msg_meta

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": 1,
                    "d:sessions/duration@second": 2,
                    "environment": None,
                    "errored": 4,
                    "healthy": 5,
                    "init": 6,
                    "production": 7,
                    "s:sessions/error@none": 8,
                    "session.status": 9,
                }
            }
        },
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                    "d:sessions/duration@second": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                    "environment": Metadata(
                        id=None,
                        fetch_type=FetchType.RATE_LIMITED,
                        fetch_type_ext=FetchTypeExt(is_global=False),
                    ),
                    "errored": Metadata(id=4, fetch_type=FetchType.DB_READ),
                    "healthy": Metadata(id=5, fetch_type=FetchType.HARDCODED),
                    "init": Metadata(id=6, fetch_type=FetchType.HARDCODED),
                    "production": Metadata(id=7, fetch_type=FetchType.CACHE_HIT),
                    "s:sessions/error@none": Metadata(id=8, fetch_type=FetchType.CACHE_HIT),
                    "session.status": Metadata(id=9, fetch_type=FetchType.CACHE_HIT),
                }
            }
        },
    ).data

    assert _get_string_indexer_log_records(caplog) == [
        (
            "process_messages.dropped_message",
            {"num_global_quotas": 0, "org_batch_size": 9, "string_type": "tags"},
        ),
        (
            "process_messages.dropped_message",
            {"num_global_quotas": 0, "org_batch_size": 9, "string_type": "tags"},
        ),
        (
            "process_messages.dropped_message",
            {"num_global_quotas": 0, "org_batch_size": 9, "string_type": "tags"},
        ),
    ]
    assert _deconstruct_messages(snuba_payloads) == []


@pytest.mark.django_db
def test_tag_value_rate_limited(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, counter_headers),
            (distribution_payload, distribution_headers),
            (set_payload, set_headers),
        ]
    )

    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=ReleaseHealthTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == (
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none",
                    "d:sessions/duration@second",
                    "environment",
                    "errored",
                    "healthy",
                    "init",
                    "production",
                    "s:sessions/error@none",
                    "session.status",
                }
            }
        }
    )
    assert not batch.invalid_msg_meta

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": 1,
                    "d:sessions/duration@second": 2,
                    "environment": 3,
                    "errored": None,
                    "healthy": 5,
                    "init": 6,
                    "production": 7,
                    "s:sessions/error@none": 8,
                    "session.status": 9,
                }
            }
        },
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                    "d:sessions/duration@second": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                    "environment": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                    "errored": Metadata(
                        id=None,
                        fetch_type=FetchType.RATE_LIMITED,
                        fetch_type_ext=FetchTypeExt(is_global=False),
                    ),
                    "healthy": Metadata(id=5, fetch_type=FetchType.HARDCODED),
                    "init": Metadata(id=6, fetch_type=FetchType.HARDCODED),
                    "production": Metadata(id=7, fetch_type=FetchType.CACHE_HIT),
                    "s:sessions/error@none": Metadata(id=8, fetch_type=FetchType.CACHE_HIT),
                    "session.status": Metadata(id=9, fetch_type=FetchType.CACHE_HIT),
                }
            }
        },
    ).data

    assert _get_string_indexer_log_records(caplog) == [
        (
            "process_messages.dropped_message",
            {"num_global_quotas": 0, "org_batch_size": 9, "string_type": "tags"},
        ),
    ]
    assert _deconstruct_messages(snuba_payloads) == [
        (
            {
                "mapping_meta": {
                    "c": {
                        "1": "c:sessions/session@none",
                        "3": "environment",
                        "7": "production",
                        "9": "session.status",
                    },
                    "h": {"6": "init"},
                },
                "metric_id": 1,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 6},
                "timestamp": ts,
                "type": "c",
                "use_case_id": "sessions",
                "value": 1.0,
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [
                *counter_headers,
                ("mapping_sources", b"ch"),
                ("metric_type", "c"),
            ],
        ),
        (
            {
                "mapping_meta": {
                    "c": {
                        "2": "d:sessions/duration@second",
                        "3": "environment",
                        "7": "production",
                        "9": "session.status",
                    },
                    "h": {"5": "healthy"},
                },
                "metric_id": 2,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"3": 7, "9": 5},
                "timestamp": ts,
                "type": "d",
                "use_case_id": "sessions",
                "value": [4, 5, 6],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [
                *distribution_headers,
                ("mapping_sources", b"ch"),
                ("metric_type", "d"),
            ],
        ),
    ]


@pytest.mark.django_db
def test_one_org_limited(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, counter_headers),
            ({**distribution_payload, "org_id": 2}, distribution_headers),
        ]
    )

    batch = IndexerBatch(
        outer_message,
        True,
        False,
        tags_validator=ReleaseHealthTagsValidator().is_allowed,
        schema_validator=MetricsSchemaValidator(
            INGEST_CODEC, RELEASE_HEALTH_SCHEMA_VALIDATION_RULES_OPTION_NAME
        ).validate,
    )
    assert batch.extract_strings() == (
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none",
                    "environment",
                    "init",
                    "production",
                    "session.status",
                },
                2: {
                    "d:sessions/duration@second",
                    "environment",
                    "healthy",
                    "production",
                    "session.status",
                },
            }
        }
    )
    assert not batch.invalid_msg_meta

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": 1,
                    "environment": None,
                    "init": 3,
                    "production": 4,
                    "session.status": 5,
                },
                2: {
                    "d:sessions/duration@second": 1,
                    "environment": 2,
                    "healthy": 3,
                    "production": 4,
                    "session.status": 5,
                },
            }
        },
        {
            UseCaseID.SESSIONS: {
                1: {
                    "c:sessions/session@none": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                    "environment": Metadata(
                        id=None,
                        fetch_type=FetchType.RATE_LIMITED,
                        fetch_type_ext=FetchTypeExt(is_global=False),
                    ),
                    "init": Metadata(id=3, fetch_type=FetchType.HARDCODED),
                    "production": Metadata(id=4, fetch_type=FetchType.CACHE_HIT),
                    "session.status": Metadata(id=5, fetch_type=FetchType.CACHE_HIT),
                },
                2: {
                    "d:sessions/duration@second": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                    "environment": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                    "healthy": Metadata(id=3, fetch_type=FetchType.HARDCODED),
                    "production": Metadata(id=4, fetch_type=FetchType.CACHE_HIT),
                    "session.status": Metadata(id=5, fetch_type=FetchType.CACHE_HIT),
                },
            }
        },
    ).data

    assert _get_string_indexer_log_records(caplog) == [
        (
            "process_messages.dropped_message",
            {"num_global_quotas": 0, "org_batch_size": 5, "string_type": "tags"},
        ),
    ]

    assert _deconstruct_messages(snuba_payloads) == [
        (
            {
                "mapping_meta": {
                    "c": {
                        "1": "d:sessions/duration@second",
                        "2": "environment",
                        "4": "production",
                        "5": "session.status",
                    },
                    "h": {"3": "healthy"},
                },
                "metric_id": 1,
                "org_id": 2,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"2": 4, "5": 3},
                "timestamp": ts,
                "type": "d",
                "use_case_id": "sessions",
                "value": [4, 5, 6],
                "sentry_received_timestamp": BROKER_TIMESTAMP.timestamp(),
            },
            [
                *distribution_headers,
                ("mapping_sources", b"ch"),
                ("metric_type", "d"),
            ],
        ),
    ]


def test_aggregation_options():

    with override_options(
        {
            "sentry-metrics.10s-granularity": False,
            "sentry-metrics.drop-percentiles.per-use-case": ["custom", "transactions"],
        }
    ):

        assert get_aggregation_options("c:custom/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:custom/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:transactions/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:transactions/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }

    with override_options(
        {
            "sentry-metrics.10s-granularity": True,
            "sentry-metrics.drop-percentiles.per-use-case": ["custom", "transactions"],
        }
    ):

        assert get_aggregation_options("c:custom/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:custom/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:transactions/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:transactions/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }

    with override_options(
        {
            "sentry-metrics.10s-granularity": False,
            "sentry-metrics.drop-percentiles.per-use-case": ["custom", "transactions", "spans"],
        }
    ):

        assert get_aggregation_options("c:custom/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:custom/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:transactions/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:spans/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:custom/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:transactions/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:transactions/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
        assert get_aggregation_options("c:spans/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }

    with override_options(
        {
            "sentry-metrics.10s-granularity": False,
            "sentry-metrics.drop-percentiles.per-use-case": ["transactions"],
        }
    ):

        assert get_aggregation_options("d:transactions/measurements.fcp@millisecond") == {
            AggregationOption.HIST: TimeWindow.NINETY_DAYS
        }

    with override_options(
        {
            "sentry-metrics.10s-granularity": True,
            "sentry-metrics.drop-percentiles.per-use-case": ["transactions", "spans"],
        }
    ):

        assert get_aggregation_options("c:custom/count@none") == {
            AggregationOption.TEN_SECOND: TimeWindow.SEVEN_DAYS
        }

        assert get_aggregation_options("d:transactions/measurements.fcp@millisecond") == {
            AggregationOption.HIST: TimeWindow.NINETY_DAYS
        }

        assert get_aggregation_options("c:transactions/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }

        assert get_aggregation_options("c:spans/count@none") == {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }
