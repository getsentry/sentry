from typing import Any, Dict, MutableMapping, Optional, Sequence, cast

import msgpack
from confluent_kafka import Message

from sentry.profiles.task import process_profile
from sentry.utils import json
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker, BatchingKafkaConsumer
from sentry.utils.kafka import create_batching_kafka_consumer


def get_profiles_consumer(
    topic: str,
    **options: Dict[str, str],
) -> BatchingKafkaConsumer:
    return create_batching_kafka_consumer(
        {topic},
        worker=ProfilesConsumer(),
        **options,
    )


class ProfilesConsumer(AbstractBatchWorker):  # type: ignore
    def process_message(self, message: Message) -> Optional[MutableMapping[str, Any]]:
        message = msgpack.unpackb(message.value(), use_list=False)
        profile = cast(Dict[str, Any], json.loads(message["payload"]))
        profile.update(
            {
                "organization_id": message["organization_id"],
                "project_id": message["project_id"],
                "received": message["received"],
            }
        )
        return profile

    def flush_batch(self, profiles: Sequence[MutableMapping[str, Any]]) -> None:
        for profile in profiles:
            process_profile.s(profile=profile).apply_async()

    def shutdown(self) -> None:
        pass
