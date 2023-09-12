from datetime import datetime
from typing import Any, Dict
from unittest.mock import Mock

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.receivers import create_default_projects
from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory, _build_snuba_span
from sentry.testutils.pytest.fixtures import django_db_all


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
            "type": "trace",
        },
    }
    payload = msgpack.packb(message_dict)

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


def test_null_tags_and_data():
    relay_span: Dict[str, Any] = {
        "data": None,
        "description": "f1323e9063f91b5745a7d33e580f9f92.jpg (56 KB)",
        "event_id": "3f0bba60b0a7471abe18732abe6506c2",
        "exclusive_time": 8.635998,
        "hash": "eb630ce41d1553f8",
        "op": "file.write",
        "origin": "auto.file.ns_data",
        "parent_span_id": "ac80578cd5d64fa9",
        "project_id": 1,
        "sampled": "true",
        "span_id": "d0a0690671b04a29",
        "start_timestamp": 1699208266.433295,
        "status": "ok",
        "tags": None,
        "timestamp": 1699208266.441931,
        "trace_id": "3f0bba60b0a7471abe18732abe6506c2",
        "type": "trace",
    }
    snuba_span = _build_snuba_span(relay_span)

    assert "tags" in snuba_span and len(snuba_span["tags"]) == 0

    relay_span["tags"] = {
        "none_tag": None,
        "false_value": False,
    }
    snuba_span = _build_snuba_span(relay_span)

    assert all([v is not None for v in snuba_span["tags"].values()])
    assert "false_value" in snuba_span["tags"]
    assert "sentry_tags" in snuba_span and len(snuba_span["sentry_tags"]) == 2

    relay_span["data"] = {
        "span.description": "",
        "span.system": None,
    }
    snuba_span = _build_snuba_span(relay_span)

    assert all([v is not None for v in snuba_span["sentry_tags"].values()])
    assert "description" in snuba_span["sentry_tags"]

    relay_span["data"] = {
        "status_code": "undefined",
        "group": "[Filtered]",
    }
    snuba_span = _build_snuba_span(relay_span)

    assert snuba_span["sentry_tags"].get("group") is None
    assert snuba_span["sentry_tags"].get("status_code") is None
