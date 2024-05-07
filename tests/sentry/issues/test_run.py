from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic
from django.db import close_old_connections

from sentry.conf.types.kafka_definition import Topic
from sentry.issues.occurrence_consumer import process_occurrence_group
from sentry.issues.producer import _prepare_occurrence_message
from sentry.issues.run import OccurrenceStrategyFactory
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.types.group import PriorityLevel
from sentry.utils import json
from sentry.utils.kafka_config import get_topic_definition
from tests.sentry.issues.test_utils import OccurrenceTestMixin


# need to shut down the connections in the thread for tests to pass
def process_occurrence_group_with_shutdown(*args, **kwargs):
    process_occurrence_group(*args, **kwargs)
    close_old_connections()


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


class TestBatchedOccurrenceConsumer(TestCase, OccurrenceTestMixin):
    def build_mock_message(self, data, topic=None):
        message = mock.Mock()
        message.value.return_value = json.dumps(data)
        if topic:
            message.topic.return_value = topic
        return message

    # @mock.patch.object(cache, "get")
    @with_feature("organizations:profile-file-io-main-thread-ingest")
    @mock.patch(
        "sentry.issues.occurrence_consumer.process_occurrence_group",
        side_effect=process_occurrence_group_with_shutdown,
    )
    @mock.patch("sentry.issues.occurrence_consumer.save_issue_occurrence")
    def test_saves_issue_occurrence(
        self, mock_save_issue_occurrence, mock_process_occurrence_group
    ):
        topic = ArroyoTopic(get_topic_definition(Topic.INGEST_OCCURRENCES)["real_topic_name"])
        partition_1 = Partition(topic, 0)
        partition_2 = Partition(topic, 1)
        mock_commit = mock.Mock()
        strategy = OccurrenceStrategyFactory(
            mode="batched-parallel",
            max_batch_size=3,
            max_batch_time=1,
        ).create_with_partitions(
            commit=mock_commit,
            partitions={},
        )

        # create 3 occurrences with 2 having the same fingerprint
        occurrence1 = self.build_occurrence(project_id=self.project.id, fingerprint=["1"])
        occurrence2 = self.build_occurrence(project_id=self.project.id, fingerprint=["2"])
        occurrence3 = self.build_occurrence(project_id=self.project.id, fingerprint=["2"])
        payload_data1 = _prepare_occurrence_message(
            occurrence1,
            {
                "project_id": self.project.id,
                "event_id": occurrence1.event_id,
                "platform": "python",
                "tags": {"my_tag": "1"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
                "environment": "production",
            },
        )
        payload_data2 = _prepare_occurrence_message(
            occurrence2,
            {
                "project_id": self.project.id,
                "event_id": occurrence2.event_id,
                "platform": "python",
                "tags": {"my_tag": "2"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
                "environment": "production",
            },
        )
        payload_data3 = _prepare_occurrence_message(
            occurrence3,
            {
                "project_id": self.project.id,
                "event_id": occurrence3.event_id,
                "platform": "python",
                "tags": {"my_tag": "3"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
                "environment": "production",
            },
        )
        message1 = self.build_mock_message(payload_data1, topic)
        message2 = self.build_mock_message(payload_data2, topic)
        message3 = self.build_mock_message(payload_data3, topic)

        with self.tasks():
            strategy.submit(
                Message(
                    BrokerValue(
                        KafkaPayload(b"group-1", message1.value().encode("utf-8"), []),
                        partition_1,
                        1,
                        datetime.now(),
                    )
                )
            )

            strategy.submit(
                Message(
                    BrokerValue(
                        KafkaPayload(b"group-2", message2.value().encode("utf-8"), []),
                        partition_2,
                        1,
                        datetime.now(),
                    )
                )
            )

            strategy.submit(
                Message(
                    BrokerValue(
                        KafkaPayload(b"group-2", message3.value().encode("utf-8"), []),
                        partition_2,
                        1,
                        datetime.now(),
                    )
                )
            )

            strategy.poll()
            strategy.join(1)
            strategy.terminate()

        calls = [mock.call({partition_1: 2, partition_2: 2})]
        mock_commit.assert_has_calls(calls=calls, any_order=True)

        assert mock_save_issue_occurrence.call_count == 3
        occurrence_data1 = occurrence1.to_dict()
        occurrence_data2 = occurrence2.to_dict()
        occurrence_data3 = occurrence3.to_dict()
        # need to modify some fields because they get mutated
        occurrence_data1["initial_issue_priority"] = PriorityLevel.LOW
        occurrence_data1["fingerprint"] = ["28c8edde3d61a0411511d3b1866f0636"]
        occurrence_data2["initial_issue_priority"] = PriorityLevel.LOW
        occurrence_data2["fingerprint"] = ["665f644e43731ff9db3d341da5c827e1"]
        occurrence_data3["initial_issue_priority"] = PriorityLevel.LOW
        occurrence_data3["fingerprint"] = ["665f644e43731ff9db3d341da5c827e1"]
        assert any(
            call.args[0] == occurrence_data1 for call in mock_save_issue_occurrence.mock_calls
        )
        assert any(
            call.args[0] == occurrence_data2 for call in mock_save_issue_occurrence.mock_calls
        )
        assert any(
            call.args[0] == occurrence_data3 for call in mock_save_issue_occurrence.mock_calls
        )

        # verify we group by the fingerprint
        assert mock_process_occurrence_group.call_count == 2
        item_list1 = mock_process_occurrence_group.mock_calls[0].args[0]
        item_list2 = mock_process_occurrence_group.mock_calls[1].args[0]
        assert len(item_list1) == 1
        assert item_list1[0]["event_id"] == occurrence1.event_id
        assert len(item_list2) == 2
        assert item_list2[0]["event_id"] == occurrence2.event_id
        assert item_list2[1]["event_id"] == occurrence3.event_id
