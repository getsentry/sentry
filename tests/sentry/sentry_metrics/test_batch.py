import logging
from datetime import datetime, timezone

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.consumers.indexer.batch import IndexerBatch, PartitionIdxOffset
from sentry.sentry_metrics.indexer.base import FetchType, FetchTypeExt, Metadata
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.utils import json

pytestmark = pytest.mark.sentry_metrics

ts = int(datetime.now(tz=timezone.utc).timestamp())
counter_payload = {
    "name": SessionMRI.SESSION.value,
    "tags": {
        "environment": "production",
        "session.status": "init",
    },
    "timestamp": ts,
    "type": "c",
    "value": 1.0,
    "org_id": 1,
    "project_id": 3,
}

distribution_payload = {
    "name": SessionMRI.RAW_DURATION.value,
    "tags": {
        "environment": "production",
        "session.status": "healthy",
    },
    "timestamp": ts,
    "type": "d",
    "value": [4, 5, 6],
    "unit": "seconds",
    "org_id": 1,
    "project_id": 3,
}

set_payload = {
    "name": SessionMRI.ERROR.value,
    "tags": {
        "environment": "production",
        "session.status": "errored",
    },
    "timestamp": ts,
    "type": "s",
    "value": [3],
    "org_id": 1,
    "project_id": 3,
}

extracted_string_output = {
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


def _construct_messages(payloads):
    message_batch = []
    for i, (payload, headers) in enumerate(payloads):
        message_batch.append(
            Message(
                Partition(Topic("topic"), 0),
                i,
                KafkaPayload(None, json.dumps(payload).encode("utf-8"), headers or []),
                datetime.now(),
            )
        )

    return message_batch


def _construct_outer_message(payloads):
    message_batch = _construct_messages(payloads)

    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]
    outer_message = Message(last.partition, last.offset, message_batch, last.timestamp)
    return outer_message


def _deconstruct_messages(snuba_messages):
    """
    Convert a list of messages returned by `reconstruct_messages` into python
    primitives, to run assertions on:

        assert _deconstruct_messages(batch.reconstruct_messages(...)) == [ ... ]

    This is slightly nicer to work with than:

        assert batch.reconstruct_messages(...) == _construct_messages([ ... ])

    ...because pytest's assertion diffs work better with python primitives.
    """
    return [
        (json.loads(msg.payload.value.decode("utf-8")), msg.payload.headers)
        for msg in snuba_messages
    ]


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


@pytest.mark.parametrize(
    "should_index_tag_values, expected",
    [
        pytest.param(
            True,
            {
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
            },
            id="index tag values true",
        ),
        pytest.param(
            False,
            {
                1: {
                    "c:sessions/session@none",
                    "d:sessions/duration@second",
                    "environment",
                    "s:sessions/error@none",
                    "session.status",
                },
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
            (counter_payload, []),
            (distribution_payload, []),
            (set_payload, []),
        ]
    )
    batch = IndexerBatch(UseCaseKey.PERFORMANCE, outer_message, should_index_tag_values)

    assert batch.extract_strings() == expected


def test_all_resolved(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, []),
            (distribution_payload, []),
            (set_payload, []),
        ]
    )

    batch = IndexerBatch(UseCaseKey.PERFORMANCE, outer_message, True)
    assert batch.extract_strings() == (
        {
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
    )

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
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
        },
        {
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
    )

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
                "use_case_id": "performance",
                "value": 1.0,
            },
            [("mapping_sources", b"ch"), ("metric_type", "c")],
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
                "unit": "seconds",
                "use_case_id": "performance",
                "value": [4, 5, 6],
            },
            [("mapping_sources", b"ch"), ("metric_type", "d")],
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
                "use_case_id": "performance",
                "value": [3],
            },
            [("mapping_sources", b"cd"), ("metric_type", "s")],
        ),
    ]


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
            (counter_payload, []),
            (distribution_payload, []),
            (set_payload, []),
        ]
    )

    batch = IndexerBatch(UseCaseKey.PERFORMANCE, outer_message, False)
    assert batch.extract_strings() == (
        {
            1: {
                "c:sessions/session@none",
                "d:sessions/duration@second",
                "environment",
                "s:sessions/error@none",
                "session.status",
            }
        }
    )

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
            1: {
                "c:sessions/session@none": 1,
                "d:sessions/duration@second": 2,
                "environment": 3,
                "s:sessions/error@none": 4,
                "session.status": 5,
            }
        },
        {
            1: {
                "c:sessions/session@none": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                "d:sessions/duration@second": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                "environment": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                "s:sessions/error@none": Metadata(id=4, fetch_type=FetchType.CACHE_HIT),
                "session.status": Metadata(id=5, fetch_type=FetchType.CACHE_HIT),
            }
        },
    )

    assert _get_string_indexer_log_records(caplog) == []
    assert _deconstruct_messages(snuba_payloads) == [
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
                "use_case_id": "performance",
                "value": 1.0,
            },
            [("mapping_sources", b"c"), ("metric_type", "c")],
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
                "unit": "seconds",
                "use_case_id": "performance",
                "value": [4, 5, 6],
            },
            [("mapping_sources", b"c"), ("metric_type", "d")],
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
                "use_case_id": "performance",
                "value": [3],
            },
            [("mapping_sources", b"c"), ("metric_type", "s")],
        ),
    ]


def test_metric_id_rate_limited(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, []),
            (distribution_payload, []),
            (set_payload, []),
        ]
    )

    batch = IndexerBatch(UseCaseKey.PERFORMANCE, outer_message, True)
    assert batch.extract_strings() == (
        {
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
    )

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
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
        },
        {
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
        },
    )

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
                "use_case_id": "performance",
                "value": [3],
            },
            [("mapping_sources", b"cd"), ("metric_type", "s")],
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


def test_tag_key_rate_limited(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, []),
            (distribution_payload, []),
            (set_payload, []),
        ]
    )

    batch = IndexerBatch(UseCaseKey.PERFORMANCE, outer_message, True)
    assert batch.extract_strings() == (
        {
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
    )

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
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
        },
        {
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
        },
    )

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


def test_tag_value_rate_limited(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, []),
            (distribution_payload, []),
            (set_payload, []),
        ]
    )

    batch = IndexerBatch(UseCaseKey.PERFORMANCE, outer_message, True)
    assert batch.extract_strings() == (
        {
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
    )

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
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
        },
        {
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
        },
    )

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
                "use_case_id": "performance",
                "value": 1.0,
            },
            [("mapping_sources", b"ch"), ("metric_type", "c")],
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
                "unit": "seconds",
                "use_case_id": "performance",
                "value": [4, 5, 6],
            },
            [("mapping_sources", b"ch"), ("metric_type", "d")],
        ),
    ]


def test_one_org_limited(caplog, settings):
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    outer_message = _construct_outer_message(
        [
            (counter_payload, []),
            ({**distribution_payload, "org_id": 2}, []),
        ]
    )

    batch = IndexerBatch(UseCaseKey.PERFORMANCE, outer_message, True)
    assert batch.extract_strings() == (
        {
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
    )

    caplog.set_level(logging.ERROR)
    snuba_payloads = batch.reconstruct_messages(
        {
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
        },
        {
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
        },
    )

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
                "unit": "seconds",
                "use_case_id": "performance",
                "value": [4, 5, 6],
            },
            [("mapping_sources", b"ch"), ("metric_type", "d")],
        ),
    ]


def test_cardinality_limiter(caplog, settings):
    """
    Test functionality of the indexer batch related to cardinality-limiting. More concretely, assert that `IndexerBatch.filter_messages`:

    1. removes the messages from the outgoing batch
    2. prevents strings from filtered messages from being extracted & indexed
    3. does not crash when strings from filtered messages are not passed into reconstruct_messages
    4. still extracts strings that exist both in filtered and unfiltered messages (eg "environment")
    """
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0

    outer_message = _construct_outer_message(
        [
            (counter_payload, []),
            (distribution_payload, []),
            (set_payload, []),
        ]
    )

    batch = IndexerBatch(UseCaseKey.PERFORMANCE, outer_message, True)
    keys_to_remove = list(batch.parsed_payloads_by_offset)[:2]
    # the messages come in a certain order, and Python dictionaries preserve
    # their insertion order. So we can hardcode offsets here.
    assert keys_to_remove == [
        PartitionIdxOffset(partition_idx=0, offset=0),
        PartitionIdxOffset(partition_idx=0, offset=1),
    ]
    batch.filter_messages(keys_to_remove)
    assert batch.extract_strings() == {
        1: {
            "environment",
            "errored",
            "production",
            # Note, we only extracted one MRI, of the one metric that we didn't
            # drop
            "s:sessions/error@none",
            "session.status",
        },
    }

    snuba_payloads = batch.reconstruct_messages(
        {
            1: {
                "environment": 1,
                "errored": 2,
                "production": 3,
                "s:sessions/error@none": 4,
                "session.status": 5,
            },
        },
        {
            1: {
                "environment": Metadata(id=1, fetch_type=FetchType.CACHE_HIT),
                "errored": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                "production": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                "s:sessions/error@none": Metadata(id=4, fetch_type=FetchType.CACHE_HIT),
                "session.status": Metadata(id=5, fetch_type=FetchType.CACHE_HIT),
            }
        },
    )

    assert _deconstruct_messages(snuba_payloads) == [
        (
            {
                "mapping_meta": {
                    "c": {
                        "1": "environment",
                        "2": "errored",
                        "3": "production",
                        "4": "s:sessions/error@none",
                        "5": "session.status",
                    },
                },
                "metric_id": 4,
                "org_id": 1,
                "project_id": 3,
                "retention_days": 90,
                "tags": {"1": 3, "5": 2},
                "timestamp": ts,
                "type": "s",
                "use_case_id": "performance",
                "value": [3],
            },
            [
                ("mapping_sources", b"c"),
                ("metric_type", "s"),
            ],
        )
    ]
