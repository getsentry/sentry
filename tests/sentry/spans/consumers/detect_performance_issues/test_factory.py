from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.consumers.detect_performance_issues.factory import (
    DetectPerformanceIssuesStrategyFactory,
)
from sentry.utils import json
from sentry.utils.kafka_config import get_topic_definition
from tests.sentry.spans.consumers.process.test_factory import build_mock_span


def build_mock_message(data, topic=None):
    message = mock.Mock()
    message.value.return_value = json.dumps(data)
    if topic:
        message.topic.return_value = topic
    return message


@mock.patch("sentry.spans.consumers.detect_performance_issues.factory.process_segment")
def test_consumer_processes_segment(mock_process_segment):

    topic = ArroyoTopic(get_topic_definition(Topic.BUFFERED_SEGMENTS)["real_topic_name"])
    partition = Partition(topic, 0)
    strategy = DetectPerformanceIssuesStrategyFactory().create_with_partitions(
        commit=mock.Mock(),
        partitions={},
    )

    span_data = build_mock_span(project_id=1)
    segment_data = {"spans": [span_data]}
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

    mock_process_segment.assert_called_once_with(segment_data["spans"])
