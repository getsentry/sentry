from typing import Callable, Dict, Mapping, Optional

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.sentry_metrics.indexer.strings import TRANSACTION_METRICS_NAMES
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


class BillingSingleMetricConsumerStrategy(ProcessingStrategy[KafkaPayload]):
    """A metrics consumer that generates a billing outcome for each matching metric.

    Processing a metric bucket at a time, looks at the given metric's ID and
    generates as many billing outcomes as values are in the bucket.

    It's assumed `TRANSACTION_METRICS_NAMES` is an immutable Dict and contains
    the given metric name. If the metric name doesn't exist as a key, it throws
    a `ValueError` in initialization. If the metric's ID is updated in
    `TRANSACTION_METRICS_NAMES`, the metric ID must be updated.
    """

    def __init__(self, metric_name) -> None:
        if metric_name not in TRANSACTION_METRICS_NAMES:
            raise ValueError(f"Unrecognized metric name: {metric_name}")

        self.counter_metric_id = TRANSACTION_METRICS_NAMES[metric_name]
        self.__futures = []
        self.__closed = False
        self.__message_payload_encoding = "utf-8"

    def poll(self) -> None:
        while self.__futures and self.__futures[0].done():
            self.__futures.popleft()

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        payload = self._get_payload(message)
        num_processed_transactions = self._estimate_processed_transactions(payload)
        self._generate_billing_outcomes(num_processed_transactions)

    def _get_payload(self, message: Message[KafkaPayload]) -> Dict:
        return json.loads(
            message.payload.value.decode(self.__message_payload_encoding), use_rapid_json=True
        )

    def _estimate_processed_transactions(self, bucket_payload: Dict) -> int:
        # Accessing TRANSACTION_METRIC_NAMES unsafely, as opposed to using
        # `get`, throws an exception. This makes it easier to identify
        # situations in which the consumer doesn't generate billing outcomes.
        if bucket_payload["metric_id"] != self.counter_metric_id:
            return 0
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
    # TODO: docs

    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return BillingSingleMetricConsumerStrategy(
            metric_name="d:transactions/duration@millisecond"
        )
