from typing import Callable, Mapping

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.utils.kafka_config import get_kafka_consumer_cluster_options


def get_metrics_billing_consumer(**options) -> StreamProcessor[KafkaPayload]:
    kafka_topic = options["topic"]
    cluster_name = settings.KAFKA_TOPICS[kafka_topic]["cluster"]

    processing_factory = _get_metrics_billing_consumer_processing_factory()

    return StreamProcessor(
        consumer=KafkaConsumer(
            get_kafka_consumer_cluster_options(
                cluster_name=cluster_name,
                # TODO: these overriding params are a workaround for now
                override_params={
                    "enable.auto.commit": False,
                    "enable.auto.offset.store": False,
                    "group.id": options["group_id"],
                },
            )
        ),
        topic=Topic(kafka_topic),
        processor_factory=processing_factory,
    )


def _get_metrics_billing_consumer_processing_factory():
    # TODO
    return BillingMetricsConsumerStrategyFactory()


class BillingMetricsConsumerStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(self) -> None:
        print("creating instance of consumer strategy...")
        self.__futures = []

    def poll(self) -> None:
        while self.__futures and self.__futures[0].done():
            self.__futures.popleft()

    def submit(self, message: Message[KafkaPayload]) -> None:
        print(f"received message: {message}")


class BillingMetricsConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        print("creating instace of factory...")

    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return BillingMetricsConsumerStrategy()
