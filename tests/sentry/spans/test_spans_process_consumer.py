from datetime import datetime
from unittest.mock import Mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.receivers import create_default_projects
from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory, _process_message
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


@django_db_all
def test_ingest_span(request):
    create_default_projects()

    factory = ProcessSpansStrategyFactory(
        output_topic="snuba-spans",
        num_processes=1,
        max_batch_size=1,
        max_batch_time=1,
        input_block_size=1,
        output_block_size=1,
    )
    strategy = factory.create_with_partitions(
        commit=Mock(),
        partitions={},
    )
    message_dict = {
        "type": "span",
        "start_time": 1691779097,
        "project_id": 1,
        "organization_id": 1,
        "retention_days": 90,
        "span": {
            "data": {
                "blocked_main_thread": False,
                "file.path": "/var/mobile/Containers/Data/Application/DECEFC04-20AF-4BDC-8473-46D43FDFDCD8/Library/Caches/com.hackemist.SDImageCache/default/f1323e9063f91b5745a7d33e580f9f92.jpg",
                "file.size": 57422,
            },
            "description": "f1323e9063f91b5745a7d33e580f9f92.jpg (56 KB)",
            "exclusive_time": 8.635998,
            "hash": "eb630ce41d1553f8",
            "op": "file.write",
            "origin": "auto.file.ns_data",
            "parent_span_id": "ac80578cd5d64fa9",
            "sampled": "true",
            "span_id": "d0a0690671b04a29",
            "start_timestamp": 1699208266.433295,
            "status": "ok",
            "timestamp": 1699208266.441931,
            "trace_id": "3f0bba60b0a7471abe18732abe6506c2",
        },
    }
    payload = json.dumps(message_dict).encode("utf-8")

    strategy.submit(
        Message(
            BrokerValue(
                KafkaPayload(
                    b"key",
                    payload,
                    [],
                ),
                Partition(Topic("ingest-spans"), 1),
                1,
                datetime.now(),
            )
        )
    )
    strategy.poll()
    strategy.join(1)
    strategy.terminate()
    request.addfinalizer(factory.shutdown)


def test_v1_span():
    # Taken from https://github.com/getsentry/relay/blob/e27eff09c32f2604e5b9e4533d891dabdd52978a/tests/integration/test_store.py#L1225-L1261
    payload = json.dumps(
        {
            "event_id": "cbf6960622e14a45abc1f03b2055b186",
            "project_id": 42,
            "organization_id": 1,
            "retention_days": 90,
            "span": {
                "description": "GET /api/0/organizations/?member=1",
                "exclusive_time": 500.0,
                "is_segment": False,
                "op": "http",
                "parent_span_id": "aaaaaaaaaaaaaaaa",
                "received": 123456789.0,
                "segment_id": "968cff94913ebb07",
                "sentry_tags": {
                    "category": "http",
                    "description": "GET *",
                    "group": "37e3d9fab1ae9162",
                    "module": "http",
                    "op": "http",
                    "transaction": "hi",
                    "transaction.op": "hi",
                },
                "span_id": "bbbbbbbbbbbbbbbb",
                "start_timestamp": 123.456,
                "timestamp": 124.567,
                "trace_id": "ff62a8b040f340bda5d830223def1d81",
                "measurements": {
                    "memory": {
                        "value": 1000.0,
                    },
                },
                "_metrics_summary": {
                    "c:spans/somemetric@none": [
                        {
                            "min": 1.0,
                            "max": 2.0,
                            "sum": 3.0,
                            "count": 1,
                            "tags": {
                                "environment": "test",
                            },
                        },
                    ],
                },
            },
        },
    ).encode()
    value = BrokerValue(KafkaPayload(None, payload, []), None, 0, None)  # type: ignore
    processed = _process_message(Message(value))
    assert isinstance(processed, KafkaPayload)
    assert json.loads(processed.value) == {
        "description": "GET /api/0/organizations/?member=1",
        "duration_ms": 1111,
        "event_id": "cbf6960622e14a45abc1f03b2055b186",
        "exclusive_time_ms": 500,
        "group_raw": "3f9ccdec3e17d794",
        "is_segment": False,
        "organization_id": 1,
        "parent_span_id": "aaaaaaaaaaaaaaaa",
        "project_id": 42,
        "received": 123456789.0,
        "retention_days": 90,
        "segment_id": "968cff94913ebb07",
        "sentry_tags": {
            "description": "GET *",
            "group": "37e3d9fab1ae9162",
            "module": "http",
            "op": "http",
            "category": "http",
            "transaction": "hi",
            "transaction.op": "hi",
        },
        "span_id": "bbbbbbbbbbbbbbbb",
        "start_timestamp_ms": 123456,
        "trace_id": "ff62a8b040f340bda5d830223def1d81",
        "measurements": {
            "memory": {
                "value": 1000.0,
            },
        },
        "_metrics_summary": {
            "c:spans/somemetric@none": [
                {
                    "min": 1.0,
                    "max": 2.0,
                    "sum": 3.0,
                    "count": 1,
                    "tags": {
                        "environment": "test",
                    },
                },
            ],
        },
    }
