from typing import Callable, Dict, Mapping, Optional

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.utils import json
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
    return BillingMetricsConsumerStrategyFactory()


class BillingMetricsConsumerStrategy(ProcessingStrategy[KafkaPayload]):
    # TODO: docs, explaining the strategy of generating outcomes

    def __init__(self) -> None:
        print("creating instance of consumer strategy...")
        self.__futures = []
        self.__closed = False
        # TODO: ensure encoding is right
        self.__message_payload_encoding = "utf-8"

    def poll(self) -> None:
        while self.__futures and self.__futures[0].done():
            self.__futures.popleft()

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        payload = self._get_payload(message)
        print(f"payload: {payload}")
        num_processed_transactions = self._estimate_processed_transactions(payload)
        self._generate_billing_outcomes(num_processed_transactions)

    def _get_payload(self, message: Message[KafkaPayload]) -> Dict:
        return json.loads(message.payload.value.decode(self.__message_payload_encoding))

    def _estimate_processed_transactions(self, bucket_payload: Dict) -> int:
        # TODO: check for the metric ID
        return len(bucket_payload["value"])

    def _generate_billing_outcomes(self, amount: int) -> None:
        # TODO
        pass

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.close()
        # TODO: do we need anything else to force the shutdown?

    def join(self, timeout: Optional[float] = None) -> None:
        pass


class BillingMetricsConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        print("creating instace of factory...")

    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return BillingMetricsConsumerStrategy()
