import logging
import time
from functools import partial
from typing import Any, Mapping, MutableMapping, Optional

from arroyo.backends.abstract import Producer as AbstractProducer
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy as ProcessingStep
from arroyo.types import Commit, Message, Partition
from confluent_kafka import Producer
from django.conf import settings

from sentry.utils import kafka_config, metrics

logger = logging.getLogger(__name__)


class SimpleProduceStep(ProcessingStep[KafkaPayload]):
    def __init__(
        self,
        output_topic: str,
        commit_function: Commit,
        commit_max_batch_size: int,
        commit_max_batch_time: float,
        producer: Optional[AbstractProducer[KafkaPayload]] = None,
    ) -> None:
        snuba_metrics = settings.KAFKA_TOPICS[output_topic]
        self.__producer = Producer(
            kafka_config.get_kafka_producer_cluster_options(snuba_metrics["cluster"]),
        )
        self.__producer_topic = output_topic
        self.__commit_function = commit_function

        self.__closed = False
        self.__produced_message_offsets: MutableMapping[Partition, int] = {}
        self.__callbacks = 0
        self.__started = time.time()
        # TODO: Need to make these flags
        self.__commit_max_batch_size = commit_max_batch_size
        self.__commit_max_batch_time = commit_max_batch_time
        self.__producer_queue_max_size = 80000
        self.__producer_long_poll_timeout = 3.0

        # poll duration metrics
        self.__poll_start_time = time.time()
        self.__poll_duration_sum = 0.0

    def _ready(self) -> bool:
        now = time.time()
        duration = now - self.__started
        if self.__callbacks >= self.__commit_max_batch_size:
            logger.info(
                f"Max size reached: total of {self.__callbacks} messages after {duration:.{2}f} seconds"
            )
            return True
        if now >= (self.__started + self.__commit_max_batch_time):
            logger.info(
                f"Max time reached: total of {self.__callbacks} messages after {duration:.{2}f} seconds"
            )
            return True

        return False

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

        if self._ready():
            self.__commit_function(self.__produced_message_offsets)
            self.__callbacks = 0
            self.__produced_message_offsets = {}
            self.__started = time.time()

    def submit(self, message: Message[KafkaPayload]) -> None:
        self.__producer.produce(
            topic=self.__producer_topic,
            key=None,
            value=message.payload.value,
            on_delivery=partial(self.callback, committable=message.committable),
            headers=message.payload.headers,
        )

    def callback(self, error: Any, message: Any, committable: Mapping[Partition, int]) -> None:
        if message and error is None:
            self.__callbacks += 1
            self.__produced_message_offsets.update(committable)
        if error is not None:
            raise Exception(error.str())

    def terminate(self) -> None:
        self.__closed = True

    def close(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float] = None) -> None:
        with metrics.timer("simple_produce_step.join_duration"):
            if not timeout:
                timeout = 5.0
            self.__producer.flush(timeout)

        if self.__callbacks:
            logger.info(f"Committing {self.__callbacks} messages...")
            self.__commit_function(self.__produced_message_offsets)
            self.__callbacks = 0
            self.__produced_message_offsets = {}
            self.__started = time.time()
