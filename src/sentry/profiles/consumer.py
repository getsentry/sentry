import logging
from typing import Any, Dict, MutableMapping, Optional, Sequence

import msgpack
from confluent_kafka import Producer
from django.conf import settings

from sentry.lang.native.processing import process_payload
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker, BatchingKafkaConsumer
from sentry.utils.kafka import create_batching_kafka_consumer

logger = logging.getLogger(__name__)


def get_profiles_consumer(
    topic: Optional[str] = None, **options: Dict[str, str]
) -> BatchingKafkaConsumer:
    config = settings.KAFKA_TOPICS[settings.KAFKA_PROFILES]
    producer = Producer(
        kafka_config.get_kafka_producer_cluster_options(config["cluster"]),
    )
    return create_batching_kafka_consumer(
        {topic},
        worker=ProfilesWorker(producer=producer),
        **options,
    )


class ProfilesWorker(AbstractBatchWorker):  # type: ignore
    def __init__(self, producer: Producer) -> None:
        self.__producer = producer
        self.__producer_topic = "processed-profiles"

    def process_message(self, message: Any) -> MutableMapping[str, Any]:
        data = msgpack.unpackb(message.value(), use_list=False)
        if data["platform"] != "ios":
            return data
        return self.symbolicate(data)

    def symbolicate(self, data: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        data["event_id"] = data["transaction_id"]
        data["project"] = data["project_id"]
        data["stacktraces"] = {"frames": []}
        data["debug_meta"] = {"images": []}
        data = process_payload(data)
        del data["event_id"]
        del data["project"]
        del data["stacktraces"]
        del data["debug_meta"]
        return data

    def flush_batch(self, batch: Sequence[MutableMapping[str, Any]]) -> None:
        self.__producer.poll(0)
        for message in batch:
            self.__producer.produce(
                self.__producer_topic, json.dumps(message), callback=self.callback
            )
        self.__producer.flush()

    def shutdown(self) -> None:
        pass

    def callback(self, error: Any, message: Any) -> None:
        if error is not None:
            raise Exception(error.str())
