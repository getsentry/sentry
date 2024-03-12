from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.consumers.recombine.factory import RecombineSegmentStrategyFactory
from sentry.utils import json
from sentry.utils.kafka_config import get_topic_definition


def build_mock_span(**kwargs):
    span = {
        "duration_ms": 0,
        "event_id": "72fcea47d44a444fb132f8d462eeb0b4",
        "exclusive_time_ms": 0.006,
        "is_segment": False,
        "parent_span_id": "93f0e87ad9cc709e",
        "profile_id": "7ce060d7ea62432b8355bc9e612676e4",
        "project_id": 1,
        "received": 1706734067.029479,
        "retention_days": 90,
        "segment_id": "ace31e54d65652aa",
        "sentry_tags": {
            "environment": "development",
            "op": "relay_fetch_org_options",
            "release": "backend@24.2.0.dev0+df7615f2ff7dc3c8802f806477f920bb934bd198",
            "transaction": "/api/0/relays/projectconfigs/",
            "transaction.method": "POST",
            "transaction.op": "http.server",
            "user": "ip:127.0.0.1",
        },
        "span_id": "95acbe6d30a66717",
        "start_timestamp_ms": 1706734066840,
        "trace_id": "8e6f22e6169545cc963255d0f29cb76b",
    }

    span.update(**kwargs)
    return json.dumps(span)


def build_mock_message(data, topic=None):
    message = mock.Mock()
    message.value.return_value = json.dumps(data)
    if topic:
        message.topic.return_value = topic
    return message


@mock.patch("sentry.spans.consumers.recombine.factory.process_segment")
def test_consumer_pushes_to_redis(mock_process_segment):

    topic = ArroyoTopic(get_topic_definition(Topic.BUFFERED_SEGMENT)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = RecombineSegmentStrategyFactory().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span()
    segment_data = [span_data]
    message = build_mock_message(segment_data, topic)

    strategy.submit(
        Message(
            BrokerValue(
                KafkaPayload(b"key", message.value().encode("utf-8"), []),
                partition,
                1,
                datetime.now(),
            )
        )
    )

    strategy.poll()
    strategy.join(1)
    strategy.terminate()

    mock_process_segment.assert_called_once_with(json.dumps(segment_data).encode("utf-8"))
