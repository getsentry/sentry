import logging
from typing import Any, Callable, Dict, Mapping, cast

import msgpack
import sentry_sdk
from arroyo.backends.kafka import KafkaProducer
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.produce import ProduceAndCommit
from arroyo.processing.strategies.run_task import RunTaskInThreads, TPayload, TResult
from arroyo.types import Message, Partition, Position, Topic
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

    def process_message(self, message: Message[TPayload]) -> TResult:
        message = msgpack.unpackb(message.payload.value, use_list=False)
        if not message["payload"]:
            return None

        profile = cast(Dict[str, Any], json.loads(message["payload"]))
        profile.update(
            {
                "organization_id": message["organization_id"],
                "project_id": message["project_id"],
                "received": message["received"],
            }
        )

        project = Project.objects.get_from_cache(id=profile["project_id"])
        profile = process_profile(profile=profile, project=project, key_id=None)

        self.__produce_call_tree(profile)

        return KafkaPayload(key=None, value=json.dumps(profile), headers=[])

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
        commit: Callable[[Mapping[Partition, Position]], None],
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
