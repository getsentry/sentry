from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.issues.producer import _prepare_occurrence_message
from sentry.issues.run import OccurrenceStrategyFactory
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.types.group import PriorityLevel
from sentry.utils import json
from sentry.utils.kafka_config import get_topic_definition
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class TestOccurrenceConsumer(TestCase, OccurrenceTestMixin):
    def build_mock_message(self, data, topic=None):
        message = mock.Mock()
        message.value.return_value = json.dumps(data)
        if topic:
            message.topic.return_value = topic
        return message

    @with_feature("organizations:profile-file-io-main-thread-ingest")
    @mock.patch("sentry.issues.occurrence_consumer.save_issue_occurrence")
    def test_saves_issue_occurrence(self, mock_save_issue_occurrence):
        topic = ArroyoTopic(get_topic_definition(Topic.INGEST_OCCURRENCES)["real_topic_name"])
        partition_1 = Partition(topic, 0)
        partition_2 = Partition(topic, 1)
        mock_commit = mock.Mock()
        strategy = OccurrenceStrategyFactory(
            num_processes=2,
            input_block_size=1,
            max_batch_size=2,
            max_batch_time=1,
            output_block_size=1,
        ).create_with_partitions(
            commit=mock_commit,
            partitions={},
        )

        occurrence = self.build_occurrence(project_id=self.project.id)
        payload_data = _prepare_occurrence_message(
            occurrence,
            {
                "project_id": self.project.id,
                "event_id": occurrence.event_id,
                "platform": "python",
                "tags": {"my_tag": "2"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
            },
        )
        message = self.build_mock_message(payload_data, topic)

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

        assert mock_save_issue_occurrence.call_count == 2
        occurrence_data = occurrence.to_dict()
        # need to modify some fields because they get mutated
        occurrence_data["initial_issue_priority"] = PriorityLevel.LOW
        occurrence_data["fingerprint"] = ["cdfb5fbc0959e8e2f27a6e6027c6335b"]
        mock_save_issue_occurrence.assert_called_with(occurrence_data, mock.ANY)
