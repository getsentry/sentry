from typing import Mapping

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry.profiles.task import process_profile_task
from sentry.utils import json


def process_message(message: Message[KafkaPayload]) -> None:
    message_dict = msgpack.unpackb(message.payload.value, use_list=False)
    profile = json.loads(message_dict["payload"], use_rapid_json=True)

    profile.update(
        {
            "organization_id": message_dict["organization_id"],
            "project_id": message_dict["project_id"],
            "received": message_dict["received"],
        }
    )
    process_profile_task.s(profile=profile).apply_async()


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
