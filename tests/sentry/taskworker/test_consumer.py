import uuid
from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic
from sentry_protos.sentry.v1.taskworker_pb2 import TaskActivation

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.consumers.factory import TaskWorkerStrategyFactory
from sentry.testutils.cases import TestCase
from sentry.utils.kafka_config import get_topic_definition


class TestTaskWorkerConsumer(TestCase):
    def build_task_activation(
        self,
        id: str,
        namespace: str,
        taskname: str,
        parameters: str,
    ) -> TaskActivation:
        return TaskActivation(id=id, namespace=namespace, taskname=taskname, parameters=parameters)

    def build_mock_message(
        self, task_activation: TaskActivation | None, topic: ArroyoTopic | None = None
    ) -> mock.Mock:
        message = mock.Mock()
        message.value.return_value = task_activation.SerializeToString()
        if topic:
            message.topic.return_value = topic
        return message

    @mock.patch("sentry.taskworker.inflight_activation_store.InflightTaskStoreSqlite.store")
    def test_save_inflight_activation(self, mock_save_activation: mock.MagicMock) -> None:
        topic = ArroyoTopic(get_topic_definition(Topic.TASK_WORKER)["real_topic_name"])
        partition_1 = Partition(topic, 0)
        partition_2 = Partition(topic, 1)
        mock_commit = mock.Mock()
        strategy = TaskWorkerStrategyFactory(
            max_batch_size=2,
            max_batch_time=5,
            num_processes=1,
            max_pending_timeout=8 * 60,
            max_inflight_activation_in_store=1000,
            input_block_size=None,
            output_block_size=None,
        ).create_with_partitions(mock_commit, {})

        task_activation = self.build_task_activation(
            id=str(uuid.uuid4()),
            namespace="test",
            taskname="test_save_inflight_activation",
            parameters="{}",
        )
        message = self.build_mock_message(task_activation, topic)

        strategy.submit(
            Message(
                BrokerValue(
                    KafkaPayload(b"key", message.value(), []),
                    partition_1,
                    1,
                    datetime.now(),
                )
            )
        )

        strategy.submit(
            Message(
                BrokerValue(
                    KafkaPayload(b"key", message.value(), []),
                    partition_2,
                    1,
                    datetime.now(),
                )
            )
        )

        strategy.poll()
        strategy.join(1)
        strategy.terminate()
        args, _ = mock_save_activation.call_args
        assert (
            len(args[0]) == 2
        )  # Assert that store() was called on a batch containing two messages
