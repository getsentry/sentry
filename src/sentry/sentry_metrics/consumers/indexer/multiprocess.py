import logging
import time
from functools import partial
from typing import Any, Mapping, MutableMapping, Optional, Union

from arroyo.backends.abstract import Producer as AbstractProducer
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy as ProcessingStep
from arroyo.types import Commit, FilteredPayload, Message, Partition
from confluent_kafka import Producer

from sentry.utils import kafka_config, metrics

logger = logging.getLogger(__name__)


class SimpleProduceStep(ProcessingStep[KafkaPayload]):
    def __init__(
        self,
        output_topic: str,
        commit_function: Commit,
        producer: Optional[AbstractProducer[KafkaPayload]] = None,
    ) -> None:
        snuba_metrics = kafka_config.get_topic_definition(output_topic)
        self.__producer = Producer(
            kafka_config.get_kafka_producer_cluster_options(snuba_metrics["cluster"]),
        )
        self.__producer_topic = output_topic
        self.__commit_function = commit_function

        self.__closed = False
        self.__produced_message_offsets: MutableMapping[Partition, int] = {}
        # TODO: Need to make these flags
        self.__producer_queue_max_size = 80000
        self.__producer_long_poll_timeout = 3.0

        # poll duration metrics
        self.__poll_start_time = time.time()
        self.__poll_duration_sum = 0.0

    def _record_poll_duration(self, poll_duration: float) -> None:
        self.__poll_duration_sum += poll_duration

        # record poll time durations every 5 seconds
        if (self.__poll_start_time + 5) < time.time():
            metrics.timing("simple_produce_step.join_duration", self.__poll_duration_sum)
            self.__poll_duration_sum = 0
            self.__poll_start_time = time.time()

    def poll_producer(self, timeout: float) -> None:
        with metrics.timer("simple_produce_step.producer_poll_duration", sample_rate=0.05):
            start = time.time()
            self.__producer.poll(timeout)
            end = time.time()

        poll_duration = end - start
        self._record_poll_duration(poll_duration)

    def poll(self) -> None:
        timeout = 0.0
        if len(self.__producer) >= self.__producer_queue_max_size:
            metrics.incr("simple_produce_step.producer_queue_backup", amount=len(self.__producer))
            timeout = self.__producer_long_poll_timeout

        self.poll_producer(timeout)

        with metrics.timer("simple_produce_step.poll.maybe_commit", sample_rate=0.05):
            self.__commit_function(self.__produced_message_offsets)
            self.__produced_message_offsets = {}

    def submit(self, message: Message[Union[KafkaPayload, FilteredPayload]]) -> None:
        if isinstance(message.payload, FilteredPayload):
            # FilteredPayload will not be commited, this may cause the the indexer to consume
            # and produce invalid message to the DLQ twice if the last messages it consume
            # are invalid and is then shutdown. But it will never produce valid messages
            # twice to snuba
            # TODO: Use the arroyo producer which handles FilteredPayload elegantly
            return
        self.__producer.produce(
            topic=self.__producer_topic,
            key=None,
            value=message.payload.value,
            on_delivery=partial(self.callback, committable=message.committable),
            headers=message.payload.headers,
        )

    def callback(self, error: Any, message: Any, committable: Mapping[Partition, int]) -> None:
        if message and error is None:
            self.__produced_message_offsets.update(committable)
        if error is not None:
            raise Exception(error.str())

    def terminate(self) -> None:
        self.__closed = True

    def close(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float] = None) -> None:
        """
        We ignore the timeout provided by the caller because we want to allow the producer to
        have at least 5 seconds to flush all messages.
        Since strategies are chained together, there is a high chance that the preceding strategy
        provides lesser timeout to this strategy. But in order to avoid producing duplicate
        messages downstream, we provide a fixed timeout of 5 seconds to the producer.
        """
        with metrics.timer("simple_produce_step.join_duration"):
            self.__producer.flush(timeout=5.0)

        self.__commit_function(self.__produced_message_offsets, force=True)
        self.__produced_message_offsets = {}
