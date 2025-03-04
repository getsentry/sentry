from datetime import datetime, timedelta
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.buffer.redis import get_redis_client
from sentry.spans.consumers.process.factory import (
    ProcessSpansStrategyFactory,
    batch_write_to_redis,
    expand_segments,
)
from sentry.spans.consumers.process_segments.factory import BUFFERED_SEGMENT_SCHEMA
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
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
        "organization_id": 1,
        "received": 1707953019.044972,
        "retention_days": 90,
        "segment_id": "a49b42af9fb69da0",
        "sentry_tags": {
            "browser.name": "Google Chrome",
            "environment": "development",
            "op": span_op or "base.dispatch.sleep",
            "release": "backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8",
            "transaction": "/api/0/organizations/{organization_id_or_slug}/n-plus-one/",
            "transaction.method": "GET",
            "transaction.op": "http.server",
            "user": "id:1",
            "platform": "python",
        },
        "span_id": "a49b42af9fb69da0",
        "start_timestamp_ms": 1707953018865,
        "start_timestamp_precise": 1707953018.865,
        "end_timestamp_precise": 1707953018.972,
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


def make_payload(message, partition, offset=1, timestamp=None):
    timestamp = timestamp or datetime.now()
    return Message(
        BrokerValue(
            KafkaPayload(
                b"key",
                message.value().encode("utf-8"),
                [
                    ("project_id", b"1"),
                ],
            ),
            partition,
            offset,
            timestamp,
        )
    )


def process_spans_strategy():
    return ProcessSpansStrategyFactory(
        num_processes=2,
        input_block_size=1,
        max_batch_size=2,
        max_batch_time=1,
        output_block_size=1,
    )


@django_db_all
@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
def test_consumer_pushes_to_redis():
    redis_client = get_redis_client()

    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = process_spans_strategy().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span(project_id=1, is_segment=True)
    message1 = build_mock_message(span_data, topic)
    strategy.submit(make_payload(message1, partition))

    span_data = build_mock_span(project_id=1)
    message2 = build_mock_message(span_data, topic)
    strategy.submit(make_payload(message2, partition))

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
def test_produces_valid_segment_to_kafka():
    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    factory = process_spans_strategy()
    with mock.patch.object(
        factory,
        "producer",
        new=mock.Mock(),
    ) as mock_producer:
        strategy = factory.create_with_partitions(
            commit=mock.Mock(),
            partitions={},
        )

        span_data = build_mock_span(project_id=1, is_segment=True)
        message1 = build_mock_message(span_data, topic)
        strategy.submit(make_payload(message1, partition, 1, datetime.now() - timedelta(minutes=3)))

        span_data = build_mock_span(project_id=1)
        message2 = build_mock_message(span_data, topic)
        strategy.submit(make_payload(message2, partition))

        strategy.poll()
        strategy.join(1)
        strategy.terminate()

        mock_producer.produce.assert_called_once()
        decoded_segment = BUFFERED_SEGMENT_SCHEMA.decode(
            mock_producer.produce.call_args.args[1].value
        )
        assert len(decoded_segment["spans"]) == 2
        assert mock_producer.produce.call_args.args[0] == ArroyoTopic("buffered-segments")


@django_db_all
@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
def test_rejects_large_message_size_to_kafka():
    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    factory = process_spans_strategy()
    with mock.patch.object(
        factory,
        "producer",
        new=mock.Mock(),
    ) as mock_producer:
        strategy = factory.create_with_partitions(
            commit=mock.Mock(),
            partitions={},
        )

        span_data = build_mock_span(
            project_id=1, is_segment=True, description="a" * 1000 * 1000 * 10
        )
        message1 = build_mock_message(span_data, topic)
        strategy.submit(make_payload(message1, partition, 1, datetime.now() - timedelta(minutes=3)))

        span_data = build_mock_span(project_id=1)
        message2 = build_mock_message(span_data, topic)
        strategy.submit(make_payload(message2, partition))

        strategy.poll()
        strategy.join(1)
        strategy.terminate()

        mock_producer.produce.assert_not_called()


@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": False,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
@mock.patch("sentry.spans.consumers.process.factory.RedisSpansBuffer")
def test_option_disabled(mock_buffer):
    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    mock_commit = mock.Mock()
    strategy = process_spans_strategy().create_with_partitions(
        commit=mock_commit,
        partitions={},
    )

    span_data = build_mock_span(project_id=1)
    message = build_mock_message(span_data, topic)
    strategy.submit(make_payload(message, partition))

    strategy.poll()
    strategy.join(1)
    strategy.terminate()
    mock_buffer.assert_not_called()

    calls = [
        mock.call({partition: 2}),
        mock.call({}, force=True),
    ]

    mock_commit.assert_has_calls(calls=calls, any_order=True)


@django_db_all
@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-rollout": 1.0,
    }
)
@mock.patch("sentry.spans.consumers.process.factory.RedisSpansBuffer")
def test_option_project_rollout_rate_discard(mock_buffer):
    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = process_spans_strategy().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span(project_id=1)
    message = build_mock_message(span_data, topic)
    strategy.submit(make_payload(message, partition))

    strategy.poll()
    strategy.join(1)
    strategy.terminate()
    mock_buffer.assert_called()


@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [2],
    }
)
@mock.patch("sentry.spans.consumers.process.factory.RedisSpansBuffer")
def test_option_project_rollout(mock_buffer):
    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_SPANS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = process_spans_strategy().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span(project_id=1)
    message = build_mock_message(span_data, topic)
    strategy.submit(make_payload(message, partition))

    strategy.poll()
    strategy.join(1)
    strategy.terminate()
    mock_buffer.assert_not_called()


@django_db_all
@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
def test_commit_and_produce_with_multiple_partitions():
    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_SPANS)["real_topic_name"])
    partition_1 = Partition(topic, 0)
    partition_2 = Partition(topic, 1)
    factory = process_spans_strategy()
    mock_commit = mock.Mock()
    with mock.patch.object(
        factory,
        "producer",
        new=mock.Mock(),
    ) as mock_producer:
        strategy = factory.create_with_partitions(
            commit=mock_commit,
            partitions={},
        )

        span_data = build_mock_span(project_id=1, is_segment=True)
        message1 = build_mock_message(span_data, topic)

        span_data = build_mock_span(project_id=1)
        message2 = build_mock_message(span_data, topic)

        offsets = {partition_1: 0, partition_2: 0}
        for _ in range(2):
            for partition in [partition_1, partition_2]:
                offset = offsets[partition]
                strategy.submit(make_payload(message1, partition, offset + 1, datetime.now()))
                strategy.submit(
                    make_payload(
                        message2, partition, offset + 2, datetime.now() + timedelta(minutes=1)
                    )
                )
                strategy.submit(
                    make_payload(
                        message2, partition, offset + 3, datetime.now() + timedelta(minutes=1)
                    )
                )
                strategy.submit(
                    make_payload(
                        message2, partition, offset + 4, datetime.now() + timedelta(minutes=3)
                    )
                )
                offsets[partition] = offset + 4

        strategy.poll()
        strategy.join(1)
        strategy.terminate()

        # max batch size is 2, one commit per batch, 1 during join
        calls = [
            mock.call({partition_1: 3}),
            mock.call({partition_1: 5}),
            mock.call({partition_1: 7}),
            mock.call({partition_1: 9}),
            mock.call({partition_2: 3}),
            mock.call({partition_2: 5}),
            mock.call({partition_2: 7}),
            mock.call({partition_2: 9}),
            mock.call({}, force=True),
        ]

        mock_commit.assert_has_calls(calls=calls, any_order=True)

        assert mock_producer.produce.call_count == 4
        BUFFERED_SEGMENT_SCHEMA.decode(mock_producer.produce.call_args.args[1].value)
        assert mock_producer.produce.call_args.args[0] == ArroyoTopic("buffered-segments")


@django_db_all
@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
def test_with_multiple_partitions():
    redis_client = get_redis_client()
    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_SPANS)["real_topic_name"])
    partition_1 = Partition(topic, 0)
    partition_2 = Partition(topic, 1)

    factory = process_spans_strategy()
    mock_commit = mock.Mock()
    with mock.patch(
        "sentry.spans.consumers.process.factory.batch_write_to_redis",
        wraps=batch_write_to_redis,
    ) as mock_batch_write_and_check_processing:
        with mock.patch.object(
            factory,
            "producer",
            new=mock.Mock(),
        ) as mock_producer:
            strategy = factory.create_with_partitions(
                commit=mock_commit,
                partitions={},
            )

            segment_1 = "89225fa064375ee5"
            span_data = build_mock_span(project_id=1, segment_id=segment_1)
            message1 = build_mock_message(span_data, topic)

            segment_2 = "a96c2bcd49de0c43"
            span_data = build_mock_span(project_id=1, segment_id=segment_2)
            message2 = build_mock_message(span_data, topic)

            now = datetime.now()
            now_plus_one_second = now + timedelta(seconds=1)

            strategy.submit(make_payload(message1, partition_1, 1, now))
            strategy.submit(make_payload(message1, partition_1, 2, now))
            strategy.submit(make_payload(message2, partition_2, 1, now))
            strategy.submit(make_payload(message2, partition_2, 2, now))
            strategy.submit(make_payload(message2, partition_2, 3, now_plus_one_second))
            strategy.poll()
            strategy.join(1)
            strategy.terminate()

            calls = [
                mock.call({partition_1: 3}),
                mock.call({partition_2: 3}),
                mock.call({partition_2: 4}),
            ]
            mock_commit.assert_has_calls(calls=calls, any_order=True)

            context_calls = [
                {partition_1: 3},
                {partition_2: 3},
                {partition_2: 4},
            ]
            assert all(
                [
                    c.args[0].committable in context_calls
                    for c in mock_batch_write_and_check_processing.mock_calls
                ]
            )
            assert mock_batch_write_and_check_processing.call_count == 3

            assert redis_client.lrange("segment:89225fa064375ee5:1:process-segment", 0, -1) == [
                message1.value().encode("utf-8"),
                message1.value().encode("utf-8"),
            ]

            assert redis_client.lrange("segment:a96c2bcd49de0c43:1:process-segment", 0, -1) == [
                message2.value().encode("utf-8"),
                message2.value().encode("utf-8"),
                message2.value().encode("utf-8"),
            ]

            mock_producer.assert_not_called()


@django_db_all
@override_options(
    {
        "standalone-spans.process-spans-consumer.enable": True,
        "standalone-spans.process-spans-consumer.project-allowlist": [1],
    }
)
def test_with_expand_segment():
    redis_client = get_redis_client()
    topic = ArroyoTopic(get_topic_definition(Topic.INGEST_SPANS)["real_topic_name"])
    partition_1 = Partition(topic, 0)
    partition_2 = Partition(topic, 1)

    factory = process_spans_strategy()
    mock_commit = mock.Mock()
    with mock.patch(
        "sentry.spans.consumers.process.factory.expand_segments", wraps=expand_segments
    ) as mock_expand_segments:
        strategy = factory.create_with_partitions(
            commit=mock_commit,
            partitions={},
        )

        segment_1 = "89225fa064375ee5"
        span_data = build_mock_span(project_id=1, segment_id=segment_1)
        message1 = build_mock_message(span_data, topic)

        segment_2 = "a96c2bcd49de0c43"
        span_data = build_mock_span(project_id=1, segment_id=segment_2)
        message2 = build_mock_message(span_data, topic)

        now = datetime.now()
        now_plus_120_seconds = now + timedelta(seconds=120)

        strategy.submit(make_payload(message1, partition_1, 1, now))
        strategy.submit(make_payload(message1, partition_1, 2, now))
        strategy.submit(make_payload(message2, partition_2, 1, now))
        strategy.submit(make_payload(message2, partition_2, 2, now))
        strategy.submit(make_payload(message2, partition_2, 3, now_plus_120_seconds))
        strategy.poll()
        strategy.join()
        strategy.terminate()

        calls = [
            mock.call({partition_1: 3}),
            mock.call({partition_2: 3}),
            mock.call({partition_2: 4}),
        ]
        mock_commit.assert_has_calls(calls=calls, any_order=True)

        assert mock_expand_segments.call_count == 3
        assert redis_client.lrange("segment:89225fa064375ee5:1:process-segment", 0, -1) == [
            message1.value().encode("utf-8"),
            message1.value().encode("utf-8"),
        ]

        assert redis_client.ttl("segment:a96c2bcd49de0c43:1:process-segment") == -2
