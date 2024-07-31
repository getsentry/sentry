from collections.abc import Mapping, MutableMapping
from datetime import datetime
from typing import Any
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic
from django.db import close_old_connections

from sentry import features
from sentry.conf.types.kafka_definition import Topic
from sentry.issues.occurrence_consumer import _process_message, process_occurrence_group
from sentry.issues.producer import (
    PayloadType,
    _prepare_occurrence_message,
    _prepare_status_change_message,
)
from sentry.issues.run import OccurrenceStrategyFactory
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import apply_feature_flag_on_cls, with_feature
from sentry.types.group import PriorityLevel
from sentry.utils import json
from sentry.utils.kafka_config import get_topic_definition
from tests.sentry.issues.test_utils import OccurrenceTestMixin, StatusChangeTestMixin


# need to shut down the connections in the thread for tests to pass
def process_occurrence_group_with_shutdown(items: list[Mapping[str, Any]]) -> None:
    process_occurrence_group(items)
    close_old_connections()


class TestOccurrenceConsumer(TestCase, OccurrenceTestMixin):
    def build_mock_message(
        self, data: MutableMapping[str, Any] | None, topic: ArroyoTopic | None = None
    ) -> mock.Mock:
        message = mock.Mock()
        message.value.return_value = json.dumps(data)
        if topic:
            message.topic.return_value = topic
        return message

    @with_feature("organizations:profile-file-io-main-thread-ingest")
    @mock.patch("sentry.issues.occurrence_consumer.save_issue_occurrence")
    def test_saves_issue_occurrence(self, mock_save_issue_occurrence: mock.MagicMock) -> None:
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

    @with_feature("organizations:profile-file-io-main-thread-ingest")
    @mock.patch("sentry.issues.run.logger")
    @mock.patch("sentry.issues.occurrence_consumer.save_issue_occurrence")
    def test_malformed_json_payload(
        self, mock_save_issue_occurrence: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        topic = ArroyoTopic(get_topic_definition(Topic.INGEST_OCCURRENCES)["real_topic_name"])
        partition = Partition(topic, 0)
        mock_commit = mock.Mock()
        strategy = OccurrenceStrategyFactory(
            num_processes=2,
            input_block_size=1,
            max_batch_size=1,
            max_batch_time=1,
            output_block_size=1,
        ).create_with_partitions(
            commit=mock_commit,
            partitions={},
        )

        message = mock.Mock()
        message.value.return_value = "malformed json"
        message.topic.return_value = topic

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

        assert mock_save_issue_occurrence.call_count == 0
        mock_logger.exception.assert_called_once_with("failed to process message payload")


class TestBatchedOccurrenceConsumer(TestCase, OccurrenceTestMixin, StatusChangeTestMixin):
    def build_mock_message(
        self, data: MutableMapping[str, Any] | None, topic: ArroyoTopic | None = None
    ) -> mock.Mock:
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
        self,
        mock_save_issue_occurrence: mock.MagicMock,
        mock_process_occurrence_group: mock.MagicMock,
    ) -> None:
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

    @with_feature("organizations:profile-file-io-main-thread-ingest")
    @mock.patch(
        "sentry.issues.occurrence_consumer.process_occurrence_group",
        side_effect=process_occurrence_group_with_shutdown,
    )
    @mock.patch("sentry.issues.occurrence_consumer.save_issue_occurrence")
    def test_issue_occurrence_status_change_mix(
        self,
        mock_save_issue_occurrence: mock.MagicMock,
        mock_process_occurrence_group: mock.MagicMock,
    ) -> None:
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
        status_change3 = self.build_statuschange(project_id=self.project.id, fingerprint=["2"])
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
        payload_data3 = _prepare_status_change_message(
            status_change3,
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
        separate_calls = [mock.call({partition_1: 2}), mock.call({partition_2: 2})]

        try:
            mock_commit.assert_has_calls(calls=calls, any_order=True)
        except AssertionError:
            mock_commit.assert_has_calls(calls=separate_calls, any_order=True)

        assert mock_save_issue_occurrence.call_count == 2
        occurrence_data1 = occurrence1.to_dict()
        occurrence_data2 = occurrence2.to_dict()

        # need to modify some fields because they get mutated
        occurrence_data1["initial_issue_priority"] = PriorityLevel.LOW
        occurrence_data1["fingerprint"] = ["28c8edde3d61a0411511d3b1866f0636"]
        occurrence_data2["initial_issue_priority"] = PriorityLevel.LOW
        occurrence_data2["fingerprint"] = ["665f644e43731ff9db3d341da5c827e1"]

        assert any(
            call.args[0] == occurrence_data1 for call in mock_save_issue_occurrence.mock_calls
        )
        assert any(
            call.args[0] == occurrence_data2 for call in mock_save_issue_occurrence.mock_calls
        )

        # verify we group by the fingerprint
        assert mock_process_occurrence_group.call_count == 2
        item_list1 = mock_process_occurrence_group.mock_calls[0].args[0]
        item_list2 = mock_process_occurrence_group.mock_calls[1].args[0]
        assert len(item_list1) == 1
        assert item_list1[0]["event_id"] == occurrence1.event_id
        assert len(item_list2) == 2
        assert item_list2[0]["event_id"] == occurrence2.event_id
        assert item_list2[1]["payload_type"] == PayloadType.STATUS_CHANGE.value

    @with_feature("organizations:profile-file-io-main-thread-ingest")
    @mock.patch(
        "sentry.issues.occurrence_consumer._process_message",
        side_effect=_process_message,
    )
    @mock.patch(
        "sentry.issues.occurrence_consumer.process_occurrence_group",
        side_effect=process_occurrence_group_with_shutdown,
    )
    @mock.patch("sentry.issues.occurrence_consumer.save_issue_occurrence")
    def test_issue_multiple_status_changes(
        self,
        mock_save_issue_occurrence: mock.MagicMock,
        mock_process_occurrence_group: mock.MagicMock,
        mock__process_message: mock.MagicMock,
    ) -> None:
        topic = ArroyoTopic(get_topic_definition(Topic.INGEST_OCCURRENCES)["real_topic_name"])
        partition = Partition(topic, 0)
        mock_commit = mock.Mock()
        strategy = OccurrenceStrategyFactory(
            mode="batched-parallel",
            max_batch_size=6,
            max_batch_time=1,
        ).create_with_partitions(
            commit=mock_commit,
            partitions={},
        )

        messages = [
            self.build_statuschange(project_id=self.project.id, fingerprint=["1"]) for _ in range(3)
        ] + [self.build_occurrence(project_id=self.project.id, fingerprint=["1"]) for _ in range(3)]

        payloads = [
            (
                _prepare_status_change_message(m)
                if isinstance(m, StatusChangeMessage)
                else _prepare_occurrence_message(
                    m,
                    {
                        "project_id": self.project.id,
                        "event_id": m.event_id,
                        "platform": "python",
                        "tags": {"my_tag": "1"},
                        "timestamp": before_now(minutes=1).isoformat(),
                        "received": before_now(minutes=1).isoformat(),
                        "environment": "production",
                    },
                )
            )
            for m in messages
        ]

        mock_messages = [self.build_mock_message(payload, topic) for payload in payloads]

        with self.tasks():
            for message in mock_messages:
                strategy.submit(
                    Message(
                        BrokerValue(
                            KafkaPayload(b"group-1", message.value().encode("utf-8"), []),
                            partition,
                            1,
                            datetime.now(),
                        )
                    )
                )

            strategy.poll()
            strategy.join(1)
            strategy.terminate()

        assert mock_save_issue_occurrence.call_count == 3
        assert mock_process_occurrence_group.call_count == 1
        item_list = mock_process_occurrence_group.mock_calls[0].args[0]
        assert len(item_list) == 6

        # this behavior depends on the feature flag
        if features.has("organizations:occurence-consumer-prune-status-changes", self.organization):
            # two status change messages should be pruned
            assert len(mock__process_message.mock_calls) == 4
            # there should be only one status change message, and it should be the last message
            assert (
                mock__process_message.mock_calls[-1].args[0]["payload_type"]
                == PayloadType.STATUS_CHANGE.value
            )
            assert (
                len(
                    [
                        call
                        for call in mock__process_message.mock_calls
                        if call.args[0]["payload_type"] == PayloadType.STATUS_CHANGE.value
                    ]
                )
                == 1
            )
        else:
            assert len(mock__process_message.mock_calls) == 6
            assert (
                len(
                    [
                        call
                        for call in mock__process_message.mock_calls
                        if call.args[0]["payload_type"] == PayloadType.STATUS_CHANGE.value
                    ]
                )
                == 3
            )


#
@apply_feature_flag_on_cls("organizations:occurence-consumer-prune-status-changes")
class TestOccurrenceConsumerWithFlags(TestOccurrenceConsumer):
    pass


# @override_options({"issues.occurrence_consumer.use_orjson": True})
@apply_feature_flag_on_cls("organizations:occurence-consumer-prune-status-changes")
class TestBatchedOccurrenceConsumerWithFlags(TestBatchedOccurrenceConsumer):
    pass
