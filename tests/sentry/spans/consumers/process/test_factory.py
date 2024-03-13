from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.buffer.redis import get_redis_client
from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory
from sentry.testutils.helpers.options import override_options
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
    return span


def build_mock_message(data, topic=None):
    message = mock.Mock()
    message.value.return_value = json.dumps(data)
    if topic:
        message.topic.return_value = topic
    return message


@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
@mock.patch("sentry.spans.consumers.process.factory.process_segment")
def test_consumer_pushes_to_redis_and_schedules_task(process_segment):
    redis_client = get_redis_client()

    topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = ProcessSpansStrategyFactory().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span()
    message = build_mock_message(span_data, topic)

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
    assert redis_client.lrange("segment:ace31e54d65652aa:1:process-segment", 0, -1) == [
        message.value()
    ]
    process_segment.apply_async.assert_called_once_with(args=[1, "ace31e54d65652aa"], countdown=120)


@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
@mock.patch("sentry.spans.consumers.process.factory.process_segment")
def test_second_span_in_segment_does_not_queue_task(process_segment):
    redis_client = get_redis_client()

    topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = ProcessSpansStrategyFactory().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span()
    message = build_mock_message(span_data, topic)

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
    assert redis_client.lrange("segment:ace31e54d65652aa:1:process-segment", 0, -1) == [
        message.value(),
        message.value(),
    ]
    process_segment.apply_async.assert_called_once_with(args=[1, "ace31e54d65652aa"], countdown=120)


@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": False,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
@mock.patch("sentry.spans.consumers.process.factory.RedisSpansBuffer")
def test_option_disabled(mock_buffer):
    topic = Topic(Topic.SNUBA_SPANS)
    partition = Partition(topic, 0)
    strategy = ProcessSpansStrategyFactory().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span()
    message = build_mock_message(span_data, topic)

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
    mock_buffer.assert_not_called()


@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [],
    }
)
@mock.patch("sentry.spans.consumers.process.factory.RedisSpansBuffer")
def test_option_project_rollout(mock_buffer):
    topic = Topic(Topic.SNUBA_SPANS)
    partition = Partition(topic, 0)
    strategy = ProcessSpansStrategyFactory().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span()
    message = build_mock_message(span_data, topic)

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
    mock_buffer.assert_not_called()
