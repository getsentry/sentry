from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.consumers.process_segments.factory import DetectPerformanceIssuesStrategyFactory
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.utils.kafka_config import get_topic_definition
from tests.sentry.spans.consumers.process.test_factory import build_mock_span


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
@mock.patch("sentry.spans.consumers.process_segments.factory.process_segment")
def test_segment_deserialized_correctly(mock_process_segment):
    topic = ArroyoTopic(get_topic_definition(Topic.BUFFERED_SEGMENTS)["real_topic_name"])
    partition_1 = Partition(topic, 0)
    partition_2 = Partition(topic, 1)
    mock_commit = mock.Mock()
    strategy = DetectPerformanceIssuesStrategyFactory(
        num_processes=2,
        input_block_size=1,
        max_batch_size=2,
        max_batch_time=1,
        output_block_size=1,
    ).create_with_partitions(
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

    calls = [
        mock.call({partition_1: 2}),
        mock.call({partition_2: 2}),
    ]

    mock_commit.assert_has_calls(calls=calls, any_order=True)

    strategy.poll()
    strategy.join(1)
    strategy.terminate()

    assert mock_process_segment.call_args.args[0] == segment_data["spans"]
