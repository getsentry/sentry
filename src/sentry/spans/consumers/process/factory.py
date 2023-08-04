from typing import Mapping

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.produce import Produce
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition, Topic
from confluent_kafka import Producer

from sentry.spans.span import Span
from sentry.utils import json, kafka_config


def process_message(message: Message[KafkaPayload]) -> None:
    payload = msgpack.unpackb(message.payload.value)
    span_dict = json.loads(payload["span"])
    span_dict["project_id"] = payload["project_id"]
    Span.from_dict(span_dict).save()


class ProcessSpansStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self, output_topic: str):
        super().__init__()
        snuba_spans = kafka_config.get_topic_definition(output_topic)
        self.__topic = Topic(name=output_topic)
        self.__producer = Producer(
            kafka_config.get_kafka_producer_cluster_options(snuba_spans["cluster"]),
        )

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_message,
            next_step=Produce(
                producer=self.__producer,
                topic=self.__topic,
                next_step=CommitOffsets(commit),
            ),
        )
