from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.spans.consumers.process_segments.factory import DetectPerformanceIssuesStrategyFactory
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.utils.kafka_config import get_topic_definition
from tests.sentry.spans.consumers.process.test_factory import build_mock_span

SNUBA_SPANS_CODEC: Codec[SpanEvent] = get_topic_codec(Topic.SNUBA_SPANS)


def build_mock_message(data, topic=None):
    message = mock.Mock()
    message.value.return_value = json.dumps(data)
    if topic:
        message.topic.return_value = topic
    return message


@override_options(
    {
        "standalone-spans.process-segments-consumer.enable": True,
    }
)
@mock.patch(
    "sentry.spans.consumers.process_segments.factory.process_segment", side_effect=lambda x: x
)
def test_segment_deserialized_correctly(mock_process_segment):
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
        assert mock_producer.produce.call_args.args[0] == ArroyoTopic("snuba-spans")
        SNUBA_SPANS_CODEC.decode(mock_producer.produce.call_args.args[1].value)
