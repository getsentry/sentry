from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.consumers.process_segments.convert import convert_span_to_item
from sentry.spans.consumers.process_segments.factory import (
    DetectPerformanceIssuesStrategyFactory,
    _check_span_duplicates,
)
from sentry.testutils.helpers.options import override_options
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist
from sentry.utils import json
from sentry.utils.kafka_config import get_topic_definition
from tests.sentry.spans.consumers.process import build_mock_span


def build_mock_message(data, topic=None):
    message = mock.Mock()
    message.value.return_value = json.dumps(data)
    if topic:
        message.topic.return_value = topic
    return message


@override_options(
    {
        "spans.process-segments.consumer.enable": True,
        "spans.process-segments.semantic-partitioning": False,
        "spans.process-segments.dedupe-ttl": 0,
        "spans.process-segments.dedupe-filter-enable": False,
    }
)
@mock.patch(
    "sentry.spans.consumers.process_segments.factory.process_segment",
    side_effect=lambda x, **kwargs: x,
)
@thread_leak_allowlist(reason="spans processing", issue=97044)
def test_segment_deserialized_correctly(mock_process_segment: mock.MagicMock) -> None:
    topic = ArroyoTopic(get_topic_definition(Topic.BUFFERED_SEGMENTS)["real_topic_name"])
    partition_1 = Partition(topic, 0)
    partition_2 = Partition(topic, 1)
    mock_commit = mock.Mock()
    factory = DetectPerformanceIssuesStrategyFactory(
        num_processes=2,
        input_block_size=1,
        max_batch_size=2,
        max_batch_time=1,
        output_block_size=1,
        skip_produce=False,
    )

    with mock.patch.object(factory, "producer", new=mock.Mock()) as mock_producer:
        strategy = factory.create_with_partitions(
            commit=mock_commit,
            partitions={},
        )

        span_data = build_mock_span(project_id=1, is_segment=True)
        segment_data = {"spans": [span_data]}
        message = build_mock_message(segment_data, topic)

        strategy.submit(
            Message(
                BrokerValue(
                    KafkaPayload(b"key", message.value().encode("utf-8"), []),
                    partition_1,
                    1,
                    datetime.now(),
                )
            )
        )

        strategy.submit(
            Message(
                BrokerValue(
                    KafkaPayload(b"key", message.value().encode("utf-8"), []),
                    partition_2,
                    1,
                    datetime.now(),
                )
            )
        )

        strategy.poll()
        strategy.join(1)
        strategy.terminate()

        calls = [
            mock.call({partition_1: 2}),
            mock.call({partition_2: 2}),
        ]
        mock_commit.assert_has_calls(calls=calls, any_order=True)

        assert mock_process_segment.call_args.args[0] == segment_data["spans"]

        assert mock_producer.produce.call_count == 2
        assert mock_producer.produce.call_args.args[0] == ArroyoTopic("snuba-items")

        payload = mock_producer.produce.call_args.args[1]
        span_item = TraceItem.FromString(payload.value)
        assert span_item == convert_span_to_item(span_data)

        headers = {k: v for k, v in payload.headers}
        assert headers["item_type"] == b"1"
        assert headers["project_id"] == b"1"


class TestCheckSpanDuplicates:
    @override_options({"spans.process-segments.dedupe-ttl": 0})
    def test_disabled_when_ttl_is_zero(self):
        spans = [build_mock_span(project_id=1, is_segment=True)]
        with mock.patch("sentry.spans.consumers.process_segments.factory.redis") as mock_redis:
            result = _check_span_duplicates(spans)
            assert result == spans
            mock_redis.redis_clusters.get_binary.assert_not_called()

    @override_options(
        {
            "spans.process-segments.dedupe-ttl": 300,
            "spans.process-segments.dedupe-filter-enable": False,
        }
    )
    def test_emits_metric_on_duplicate(self):
        spans = [
            build_mock_span(project_id=1, is_segment=True, span_id="span1"),
            build_mock_span(project_id=1, is_segment=False, span_id="span2"),
        ]
        with (
            mock.patch("sentry.spans.consumers.process_segments.factory.redis") as mock_redis,
            mock.patch("sentry.spans.consumers.process_segments.factory.metrics") as mock_metrics,
        ):
            mock_client = mock.MagicMock()
            mock_pipeline = mock.MagicMock()
            mock_redis.redis_clusters.get_binary.return_value = mock_client
            mock_client.pipeline.return_value.__enter__.return_value = mock_pipeline
            # First span is duplicate (setnx returns False), second is new (returns True)
            mock_pipeline.execute.return_value = [False, True]

            result = _check_span_duplicates(spans)

            # All spans returned when not filtering
            assert result == spans
            mock_metrics.incr.assert_called_once_with(
                "spans.process-segments.duplicate_span", amount=1
            )

    @override_options(
        {
            "spans.process-segments.dedupe-ttl": 300,
            "spans.process-segments.dedupe-filter-enable": True,
        }
    )
    def test_filters_duplicates_when_enabled(self):
        spans = [
            build_mock_span(project_id=1, is_segment=True, span_id="span1"),
            build_mock_span(project_id=1, is_segment=False, span_id="span2"),
        ]
        with (
            mock.patch("sentry.spans.consumers.process_segments.factory.redis") as mock_redis,
            mock.patch("sentry.spans.consumers.process_segments.factory.metrics") as mock_metrics,
        ):
            mock_client = mock.MagicMock()
            mock_pipeline = mock.MagicMock()
            mock_redis.redis_clusters.get_binary.return_value = mock_client
            mock_client.pipeline.return_value.__enter__.return_value = mock_pipeline
            # First span is duplicate (setnx returns False), second is new (returns True)
            mock_pipeline.execute.return_value = [False, True]

            result = _check_span_duplicates(spans)

            # Only new span returned when filtering
            assert len(result) == 1
            assert result[0]["span_id"] == "span2"
            mock_metrics.incr.assert_called_once_with(
                "spans.process-segments.duplicate_span", amount=1
            )
