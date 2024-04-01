from datetime import datetime, timedelta
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic
from django.test import override_settings

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.buffer.redis import get_redis_client
from sentry.spans.consumers.detect_performance_issues.factory import BUFFERED_SEGMENT_SCHEMA
from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_topic_definition


def build_mock_span(project_id, span_op=None, **kwargs):
    span = {
        "description": "OrganizationNPlusOne",
        "duration_ms": 107,
        "event_id": "61ccae71d70f45bb9b1f2ccb7f7a49ec",
        "exclusive_time_ms": 107.359,
        "is_segment": True,
        "parent_span_id": "b35b839c02985f33",
        "profile_id": "dbae2b82559649a1a34a2878134a007b",
        "project_id": project_id,
        "received": 1707953019.044972,
        "retention_days": 90,
        "segment_id": "a49b42af9fb69da0",
        "sentry_tags": {
            "browser.name": "Google Chrome",
            "environment": "development",
            "op": span_op or "base.dispatch.sleep",
            "release": "backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8",
            "transaction": "/api/0/organizations/{organization_slug}/n-plus-one/",
            "transaction.method": "GET",
            "transaction.op": "http.server",
            "user": "id:1",
        },
        "span_id": "a49b42af9fb69da0",
        "start_timestamp_ms": 1707953018865,
        "trace_id": "94576097f3a64b68b85a59c7d4e3ee2a",
    }

    span.update(**kwargs)
    return span


def build_mock_message(data, topic=None):
    message = mock.Mock()
    message.value.return_value = json.dumps(data)
    if topic:
        message.topic.return_value = topic
    return message


def process_spans_strategy():
    return ProcessSpansStrategyFactory(
        num_processes=2,
        input_block_size=1,
        max_batch_size=1,
        max_batch_time=1,
        output_block_size=1,
    )


@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
def test_consumer_pushes_to_redis():
    redis_client = get_redis_client()

    topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = process_spans_strategy().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span(project_id=1, is_segment=True)
    message1 = build_mock_message(span_data, topic)

    strategy.submit(
        Message(
            BrokerValue(
                KafkaPayload(
                    b"key",
                    message1.value().encode("utf-8"),
                    [
                        ("project_id", b"1"),
                    ],
                ),
                partition,
                1,
                datetime.now(),
            )
        )
    )

    span_data = build_mock_span(project_id=1)
    message2 = build_mock_message(span_data, topic)

    strategy.submit(
        Message(
            BrokerValue(
                KafkaPayload(
                    b"key",
                    message2.value().encode("utf-8"),
                    [
                        ("project_id", b"1"),
                    ],
                ),
                partition,
                1,
                datetime.now(),
            )
        )
    )

    strategy.poll()
    strategy.join(1)
    strategy.terminate()

    assert redis_client.lrange("segment:a49b42af9fb69da0:1:process-segment", 0, -1) == [
        message1.value().encode("utf-8"),
        message2.value().encode("utf-8"),
    ]


@django_db_all
@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
@override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
@mock.patch.object(SingletonProducer, "produce")
def test_produces_valid_segment_to_kafka(mock_produce):
    topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = process_spans_strategy().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span(project_id=1, is_segment=True)
    message1 = build_mock_message(span_data, topic)

    strategy.submit(
        Message(
            BrokerValue(
                KafkaPayload(
                    b"key",
                    message1.value().encode("utf-8"),
                    [
                        ("project_id", b"1"),
                    ],
                ),
                partition,
                1,
                datetime.now() - timedelta(minutes=3),
            )
        )
    )

    span_data = build_mock_span(project_id=1)
    message2 = build_mock_message(span_data, topic)

    strategy.submit(
        Message(
            BrokerValue(
                KafkaPayload(
                    b"key",
                    message2.value().encode("utf-8"),
                    [
                        ("project_id", b"1"),
                    ],
                ),
                partition,
                1,
                datetime.now(),
            )
        )
    )

    mock_produce.assert_called_once()
    BUFFERED_SEGMENT_SCHEMA.decode(mock_produce.call_args.args[1].value)
    assert mock_produce.call_args.args[0] == ArroyoTopic("buffered-segments")


@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": False,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
@mock.patch("sentry.spans.consumers.process.factory.RedisSpansBuffer")
def test_option_disabled(mock_buffer):
    topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = process_spans_strategy().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span(project_id=1)
    message = build_mock_message(span_data, topic)

    strategy.submit(
        Message(
            BrokerValue(
                KafkaPayload(
                    b"key",
                    message.value().encode("utf-8"),
                    [
                        ("project_id", b"1"),
                    ],
                ),
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
        "standalone-spans.process-spans-consumer.project-allowlist": [
            ("project_id", b"1"),
        ],
    }
)
@mock.patch("sentry.spans.consumers.process.factory.RedisSpansBuffer")
def test_option_project_rollout(mock_buffer):
    topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = process_spans_strategy().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span(project_id=1)
    message = build_mock_message(span_data, topic)

    strategy.submit(
        Message(
            BrokerValue(
                KafkaPayload(
                    b"key",
                    message.value().encode("utf-8"),
                    [
                        ("project_id", b"1"),
                    ],
                ),
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
