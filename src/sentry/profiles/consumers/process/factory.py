import logging
from typing import Mapping

import msgpack
import sentry_sdk
from arroyo.backends.kafka import KafkaProducer
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.produce import ProduceAndCommit
from arroyo.processing.strategies.run_task import RunTaskInThreads
from arroyo.types import Commit, Message, Partition, Topic
from django.conf import settings

from sentry.models import Project
from sentry.profiles.task import (
    Profile,
    _get_event_instance_for_legacy,
    _get_event_instance_for_sample,
    process_profile,
)
from sentry.utils import json, kafka_config

logger = logging.getLogger(__name__)


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """
    This consumer processes replay recordings, which are compressed payloads split up into
    chunks.
    """

    def process_message(self, message: Message[KafkaPayload]) -> KafkaPayload:
        message_dict = msgpack.unpackb(message.payload.value, use_list=False)
        profile = json.loads(message_dict["payload"])
        profile.update(
            {
                "organization_id": message_dict["organization_id"],
                "project_id": message_dict["project_id"],
                "received": message_dict["received"],
            }
        )

        project = Project.objects.get_from_cache(id=profile["project_id"])
        profile = process_profile(profile=profile, project=project, key_id=None)

        self.__produce_call_tree(profile)

        return KafkaPayload(key=None, value=json.dumps(profile, use_rapid_json=True), headers=[])

    def __produce_call_tree(self, profile: Profile) -> None:
        try:
            if "version" in profile:
                event = _get_event_instance_for_sample(profile)
            else:
                event = _get_event_instance_for_legacy(profile)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return

        self.__producer.produce(
            Topic(name="profiles-call-tree"),
            KafkaPayload(key=None, value=json.dumps(event).encode("utf-8"), headers=[]),
        )

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        config = settings.KAFKA_TOPICS[settings.KAFKA_PROFILES]
        self.__producer = KafkaProducer(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"]),
        )
        return RunTaskInThreads(
            processing_function=self.process_message,
            concurrency=16,
            max_pending_futures=16,
            next_step=ProduceAndCommit(
                producer=self.__producer,
                topic=Topic(name="processed-profiles"),
                commit=commit,
            ),
        )
