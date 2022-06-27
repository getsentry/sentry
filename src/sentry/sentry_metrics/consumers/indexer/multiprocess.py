import functools
import logging
import time
from dataclasses import dataclass
from functools import partial
from typing import Any, Callable, Mapping, MutableMapping, Optional, Union

from arroyo.backends.abstract import Producer as AbstractProducer
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies import ProcessingStrategy as ProcessingStep
from arroyo.processing.strategies import ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position, Topic
from confluent_kafka import Producer
from django.conf import settings

from sentry.sentry_metrics.configuration import MetricsIngestConfiguration
from sentry.sentry_metrics.consumers.indexer.common import BatchMessages, MessageBatch, get_config
from sentry.sentry_metrics.consumers.indexer.processing import process_messages
from sentry.utils import kafka_config
from sentry.utils.batching_kafka_consumer import create_topics

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=10)
def get_metrics():  # type: ignore
    from sentry.utils import metrics

    return metrics


class BatchConsumerStrategyFactory(ProcessingStrategyFactory):  # type: ignore
    """
    Batching Consumer Strategy
    """

    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: float,
        commit_max_batch_size: int,
        commit_max_batch_time: int,
        config: MetricsIngestConfiguration,
    ):
        self.__max_batch_time = max_batch_time
        self.__max_batch_size = max_batch_size
        self.__commit_max_batch_time = commit_max_batch_time
        self.__commit_max_batch_size = commit_max_batch_size
        self.__config = config

    def create(
        self, commit: Callable[[Mapping[Partition, Position]], None]
    ) -> ProcessingStrategy[KafkaPayload]:
        transform_step = TransformStep(
            next_step=SimpleProduceStep(
                commit_function=commit,
                commit_max_batch_size=self.__commit_max_batch_size,
                # convert to seconds
                commit_max_batch_time=self.__commit_max_batch_time / 1000,
                output_topic=self.__config.output_topic,
            ),
            config=self.__config,
        )
        strategy = BatchMessages(transform_step, self.__max_batch_time, self.__max_batch_size)
        return strategy


class TransformStep(ProcessingStep[MessageBatch]):  # type: ignore
    """
    Temporary Transform Step
    """

    def __init__(
        self, next_step: ProcessingStep[KafkaPayload], config: MetricsIngestConfiguration
    ) -> None:
        self.__process_messages: Callable[[Message[MessageBatch]], MessageBatch] = partial(
            process_messages, config.use_case_id
        )
        self.__next_step = next_step
        self.__closed = False
        self.__metrics = get_metrics()

    def poll(self) -> None:
        self.__next_step.poll()

    def submit(self, message: Message[MessageBatch]) -> None:
        assert not self.__closed

        with self.__metrics.timer("transform_step.process_messages"):
            transformed_message_batch = self.__process_messages(message)

        for transformed_message in transformed_message_batch:
            self.__next_step.submit(transformed_message)

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.__closed = True

        logger.debug("Terminating %r...", self.__next_step)
        self.__next_step.terminate()

    def join(self, timeout: Optional[float] = None) -> None:
        self.__next_step.close()
        self.__next_step.join(timeout)


class UnflushedMessages(Exception):
    pass


class OutOfOrderOffset(Exception):
    pass


@dataclass
class PartitionOffset:
    position: Position
    partition: Partition


class SimpleProduceStep(ProcessingStep[KafkaPayload]):  # type: ignore
    def __init__(
        self,
        output_topic: str,
        commit_function: Callable[[Mapping[Partition, Position]], None],
        commit_max_batch_size: int,
        commit_max_batch_time: float,
        producer: Optional[AbstractProducer] = None,
    ) -> None:
        snuba_metrics = settings.KAFKA_TOPICS[output_topic]
        self.__producer = Producer(
            kafka_config.get_kafka_producer_cluster_options(snuba_metrics["cluster"]),
        )
        self.__producer_topic = output_topic
        self.__commit_function = commit_function

        self.__closed = False
        self.__metrics = get_metrics()
        self.__produced_message_offsets: MutableMapping[Partition, Position] = {}
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
            self.__metrics.timing("simple_produce_step.join_duration", self.__poll_duration_sum)
            self.__poll_duration_sum = 0
            self.__poll_start_time = time.time()

    def poll_producer(self, timeout: float) -> None:
        with self.__metrics.timer("simple_produce_step.producer_poll_duration", sample_rate=0.05):
            start = time.time()
            self.__producer.poll(timeout)
            end = time.time()

        poll_duration = end - start
        self._record_poll_duration(poll_duration)

    def poll(self) -> None:
        timeout = 0.0
        if len(self.__producer) >= self.__producer_queue_max_size:
            self.__metrics.incr(
                "simple_produce_step.producer_queue_backup", amount=len(self.__producer)
            )
            timeout = self.__producer_long_poll_timeout

        self.poll_producer(timeout)

        if self._ready():
            self.__commit_function(self.__produced_message_offsets)
            self.__callbacks = 0
            self.__produced_message_offsets = {}
            self.__started = time.time()

    def submit(self, message: Message[KafkaPayload]) -> None:
        position = Position(message.next_offset, message.timestamp)
        self.__producer.produce(
            topic=self.__producer_topic,
            key=None,
            value=message.payload.value,
            on_delivery=partial(self.callback, partition=message.partition, position=position),
            headers=message.payload.headers,
        )

    def callback(self, error: Any, message: Any, partition: Partition, position: Position) -> None:
        if message and error is None:
            self.__callbacks += 1
            self.__produced_message_offsets[partition] = position
        if error is not None:
            raise Exception(error.str())

    def terminate(self) -> None:
        self.__closed = True

    def close(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float]) -> None:
        with self.__metrics.timer("simple_produce_step.join_duration"):
            if not timeout:
                timeout = 5.0
            self.__producer.flush(timeout)

        if self.__callbacks:
            logger.info(f"Committing {self.__callbacks} messages...")
            self.__commit_function(self.__produced_message_offsets)
            self.__callbacks = 0
            self.__produced_message_offsets = {}
            self.__started = time.time()


def get_streaming_metrics_consumer(
    topic: str,
    commit_max_batch_size: int,
    commit_max_batch_time: int,
    max_batch_size: int,
    max_batch_time: float,
    processes: int,
    input_block_size: int,
    output_block_size: int,
    group_id: str,
    auto_offset_reset: str,
    factory_name: str,
    indexer_profile: MetricsIngestConfiguration,
    **options: Mapping[str, Union[str, int]],
) -> StreamProcessor:
    assert factory_name == "default"
    processing_factory = BatchConsumerStrategyFactory(
        max_batch_size=max_batch_size,
        max_batch_time=max_batch_time,
        commit_max_batch_size=commit_max_batch_size,
        commit_max_batch_time=commit_max_batch_time,
        config=indexer_profile,
    )

    cluster_name: str = settings.KAFKA_TOPICS[indexer_profile.input_topic]["cluster"]
    create_topics(cluster_name, [indexer_profile.input_topic])

    return StreamProcessor(
        KafkaConsumer(get_config(indexer_profile.input_topic, group_id, auto_offset_reset)),
        Topic(indexer_profile.input_topic),
        processing_factory,
    )
