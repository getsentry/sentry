import logging
from datetime import datetime, timezone

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.consumers.indexer.batch import IndexerBatch
from sentry.sentry_metrics.indexer.base import FetchType, Metadata
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


def test_all_resolved(caplog):
    outer_message = _construct_outer_message(
        [
            (counter_payload, []),
            (distribution_payload, []),
            (set_payload, []),
        ]
    )

    batch = IndexerBatch(UseCaseKey.PERFORMANCE, outer_message)
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
