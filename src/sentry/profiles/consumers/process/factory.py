from typing import Mapping

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry.profiles.task import process_profile_task
from sentry.utils import json, metrics


def process_message(message: Message[KafkaPayload]) -> None:
    message_dict = msgpack.unpackb(message.payload.value, use_list=False)

    with metrics.timer("profiles.consumer.duration", instance="json.loads"):
        metrics.timing("profiles.consumer.profile.size", len(message_dict["payload"]))
        profile = json.loads(message_dict["payload"], use_rapid_json=True)

    tags = {"platform": profile["platform"]}

    if "version" in profile and profile["version"]:
        tags["version"] = profile["version"]
        tags["format"] = "sample"
    else:
        tags["format"] = "legacy"

    metrics.incr(
        "process_profile.profile.format",
        tags=tags,
        sample_rate=1.0,
    )

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
