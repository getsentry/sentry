from typing import Any, Dict, MutableMapping, Optional, Sequence

import msgpack
from confluent_kafka import Message
from django.conf import settings

from sentry.profiles.tasks import process_profile
from sentry.utils import json
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker, BatchingKafkaConsumer
from sentry.utils.kafka import create_batching_kafka_consumer


def get_profiles_consumer(
    topic: Optional[str] = None, **options: Dict[str, str]
) -> BatchingKafkaConsumer:
    return create_batching_kafka_consumer(
        {settings.KAFKA_PROFILES},
        worker=ProfilesWorker(),
        **options,
    )


class ProfilesWorker(AbstractBatchWorker):  # type: ignore
    def process_message(self, message: Message) -> Optional[MutableMapping[str, Any]]:
        message = msgpack.unpackb(message.value(), use_list=False)
        profile = json.loads(message["payload"])

        profile.update(
            {
                "organization_id": message["organization_id"],
                "project_id": message["project_id"],
                "received": message["received"],
            }
        )
        process_profile.delay(profile=profile)

    def flush_batch(self, profiles: Sequence[MutableMapping[str, Any]]) -> None:
        pass

    def shutdown(self) -> None:
        pass
