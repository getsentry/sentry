import logging
import time
from abc import abstractmethod
from dataclasses import dataclass
from functools import partial
from typing import Any, Callable, Mapping, MutableMapping, Optional, Union

from arroyo.backends.abstract import Producer as AbstractProducer
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies import ProcessingStrategy as ProcessingStep
from arroyo.processing.strategies import ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position, Topic, TPayload
from confluent_kafka import Producer
from django.conf import settings

from sentry.sentry_metrics.configuration import MetricsIngestConfiguration
from sentry.sentry_metrics.consumers.indexer.common import BatchMessages, MessageBatch, get_config
from sentry.sentry_metrics.consumers.indexer.processing import MessageProcessor
from sentry.utils import kafka_config, metrics
from sentry.utils.batching_kafka_consumer import create_topics

logger = logging.getLogger(__name__)


class BatchConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
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

    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
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


class TransformStep(ProcessingStep[MessageBatch]):
    """
    Temporary Transform Step
    """

    def __init__(
        self, next_step: ProcessingStep[KafkaPayload], config: MetricsIngestConfiguration
    ) -> None:
        self.__message_processor: MessageProcessor = MessageProcessor(config)
        self.__next_step = next_step
        self.__closed = False

    def poll(self) -> None:
        self.__next_step.poll()

    def submit(self, message: Message[MessageBatch]) -> None:
        assert not self.__closed

        with metrics.timer("transform_step.process_messages"):
            transformed_message_batch = self.__message_processor.process_messages(message)

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


class SimpleProduceStep(ProcessingStep[KafkaPayload]):
    def __init__(
        self,
        output_topic: str,
        commit_function: Callable[[Mapping[Partition, Position]], None],
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


class RoutingProducerStep(ProcessingStep[KafkaPayload]):
    def __init__(
        self,
        commit_function: Callable[[Mapping[Partition, Position]], None],
        commit_max_batch_size: int,
        commit_max_batch_time: float,
    ) -> None:
        self.__producer_topic_map: Mapping[Producer, str] = self.populate_producers()
        self.__commit_function = commit_function

        self.__closed = False
        self.__offsets_to_be_committed: MutableMapping[Partition, Position] = {}
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
            metrics.timing("routing_produce_step.join_duration", self.__poll_duration_sum)
            self.__poll_duration_sum = 0
            self.__poll_start_time = time.time()

    def poll_producer(self, producer: Producer, timeout: float) -> None:
        with metrics.timer("routing_produce_step.producer_poll_duration", sample_rate=0.05):
            start = time.time()
            producer.poll(timeout)
            end = time.time()

        poll_duration = end - start
        self._record_poll_duration(poll_duration)

    def poll(self) -> None:
        for producer in self.__producer_topic_map.keys():
            timeout = 0.0
            if len(producer) >= self.__producer_queue_max_size:
                metrics.incr("routing_produce_step.producer_queue_backup", amount=len(producer))
                timeout = self.__producer_long_poll_timeout

            self.poll_producer(producer, timeout)

        if self._ready():
            self.__commit_function(self.__offsets_to_be_committed)
            self.__callbacks = 0
            self.__offsets_to_be_committed = {}
            self.__started = time.time()

    def submit(self, message: Message[TPayload]) -> None:
        position = Position(message.next_offset, message.timestamp)
        producer = self.get_producer_from_message(message)
        producer.produce(
            topic=self.__producer_topic_map[producer],
            key=None,
            value=message.payload.value,
            on_delivery=partial(self.callback, partition=message.partition, position=position),
            headers=message.payload.headers,
        )

    def callback(self, error: Any, message: Any, partition: Partition, position: Position) -> None:
        if message and error is None:
            self.__callbacks += 1
            self.__offsets_to_be_committed[partition] = position
        if error is not None:
            raise Exception(error.str())

    def terminate(self) -> None:
        self.__closed = True

    def close(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float] = None) -> None:
        with metrics.timer("routing_produce_step.join_duration"):
            if not timeout:
                timeout = 5.0
            for producer in self.__producer_topic_map.keys():
                producer.flush(timeout)

        if self.__callbacks:
            logger.info(f"Committing {self.__callbacks} messages...")
            self.__commit_function(self.__offsets_to_be_committed)
            self.__callbacks = 0
            self.__offsets_to_be_committed = {}
            self.__started = time.time()

    @abstractmethod
    def populate_producers(self) -> Mapping[Producer, str]:
        pass

    @abstractmethod
    def get_producer_from_message(self, message: Message[TPayload]) -> Producer:
        pass


class PartitionedRoutingProducerStep(RoutingProducerStep):
    def __init__(
        self,
        output_topic: str,
        commit_function: Callable[[Mapping[Partition, Position]], None],
        commit_max_batch_size: int,
        commit_max_batch_time: float,
    ) -> None:
        self.__output_topic = output_topic
        self.__num_logical_partitions = 256
        super().__init__(commit_function, commit_max_batch_size, commit_max_batch_time)

    def populate_producers(self) -> Mapping[Producer, str]:
        self.__slice_to_producer: MutableMapping[int, Producer] = {}
        self.__slice_to_producer_topic: MutableMapping[int, str] = {}

        if len(settings.SLICED_KAFKA_TOPIC_MAP) == 0:
            self.__slice_to_producer[0] = Producer(
                kafka_config.get_kafka_producer_cluster_options(
                    settings.KAFKA_TOPICS[self.__output_topic]["cluster"]
                )
            )
            self.__slice_to_producer_topic[0] = self.__output_topic
        else:
            for (_, slice_id), config in settings.SLICED_KAFKA_BROKER_CONFIG.items():
                self.__slice_to_producer[slice_id] = Producer(config)
            for (_, slice_id), topic in settings.SLICED_KAFKA_TOPIC_MAP.items():
                self.__slice_to_producer_topic[slice_id] = topic

        assert len(self.__slice_to_producer) == len(self.__slice_to_producer_topic)

        return dict(zip(self.__slice_to_producer.values(), self.__slice_to_producer_topic.values()))

    def _map_organization_id_to_slice(self, org_id: int) -> int:
        return settings.LOGICAL_PARTITION_MAPPING[org_id % self.__num_logical_partitions]

    def get_producer_from_message(self, message: Message[TPayload]) -> Producer:
        org_id: Optional[int] = next(
            (int(header[1]) for header in message.payload.headers if header[0] == "org_id"),
            None,
        )
        if org_id is None:
            producer = self.__slice_to_producer[0]
        else:
            slice_id = self._map_organization_id_to_slice(org_id)
            producer = self.__slice_to_producer[slice_id]

        return producer


class PartitionedProduceStep(ProcessingStep[KafkaPayload]):
    def __init__(
        self,
        output_topic: str,
        commit_function: Callable[[Mapping[Partition, Position]], None],
        commit_max_batch_size: int,
        commit_max_batch_time: float,
    ) -> None:
        self.__num_logical_partitions = 256

        self.__slice_to_producer: MutableMapping[int, Producer] = {}
        self.__slice_to_producer_topic: MutableMapping[int, str] = {}

        if len(settings.SLICED_KAFKA_TOPIC_MAP) == 0:
            self.__slice_to_producer[0] = Producer(
                kafka_config.get_kafka_producer_cluster_options(
                    settings.KAFKA_TOPICS[output_topic]["cluster"]
                )
            )
            self.__slice_to_producer_topic[0] = output_topic
        else:
            for (_, slice_id), config in settings.SLICED_KAFKA_BROKER_CONFIG.items():
                self.__slice_to_producer[slice_id] = Producer(config)
            for (_, slice_id), topic in settings.SLICED_KAFKA_TOPIC_MAP.items():
                self.__slice_to_producer_topic[slice_id] = topic

        assert len(self.__slice_to_producer) == len(self.__slice_to_producer_topic)

        self.__commit_function = commit_function

        self.__closed = False
        self.__offsets_to_be_committed: MutableMapping[Partition, Position] = {}
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
            metrics.timing("partitioned_produce_step.join_duration", self.__poll_duration_sum)
            self.__poll_duration_sum = 0
            self.__poll_start_time = time.time()

    def poll_producer(self, producer: Producer, timeout: float) -> None:
        with metrics.timer("partitioned_produce_step.producer_poll_duration", sample_rate=0.05):
            start = time.time()
            producer.poll(timeout)
            end = time.time()

        poll_duration = end - start
        self._record_poll_duration(poll_duration)

    def poll(self) -> None:
        for producer in self.__slice_to_producer.values():
            timeout = 0.0
            if len(producer) >= self.__producer_queue_max_size:
                metrics.incr("partitioned_produce_step.producer_queue_backup", amount=len(producer))
                timeout = self.__producer_long_poll_timeout

            self.poll_producer(producer, timeout)

        if self._ready():
            self.__commit_function(self.__offsets_to_be_committed)
            self.__callbacks = 0
            self.__offsets_to_be_committed = {}
            self.__started = time.time()

    def _map_organization_id_to_slice(self, org_id: int) -> int:
        return settings.LOGICAL_PARTITION_MAPPING[org_id % self.__num_logical_partitions]

    def submit(self, message: Message[KafkaPayload]) -> None:
        position = Position(message.next_offset, message.timestamp)
        org_id: Optional[int] = next(
            (int(header[1]) for header in message.payload.headers if header[0] == "org_id"),
            None,
        )
        if org_id is None:
            producer = self.__slice_to_producer[0]
            producer_topic = self.__slice_to_producer_topic[0]
        else:
            slice_id = self._map_organization_id_to_slice(org_id)
            producer = self.__slice_to_producer[slice_id]
            producer_topic = self.__slice_to_producer_topic[slice_id]
        producer.produce(
            topic=producer_topic,
            key=None,
            value=message.payload.value,
            on_delivery=partial(self.callback, partition=message.partition, position=position),
            headers=message.payload.headers,
        )

    def callback(self, error: Any, message: Any, partition: Partition, position: Position) -> None:
        if message and error is None:
            self.__callbacks += 1
            self.__offsets_to_be_committed[partition] = position
        if error is not None:
            raise Exception(error.str())

    def terminate(self) -> None:
        self.__closed = True

    def close(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float] = None) -> None:
        with metrics.timer("partitioned_produce_step.join_duration"):
            if not timeout:
                timeout = 5.0
            for producer in self.__slice_to_producer.values():
                producer.flush(timeout)

        if self.__callbacks:
            logger.info(f"Committing {self.__callbacks} messages...")
            self.__commit_function(self.__offsets_to_be_committed)
            self.__callbacks = 0
            self.__offsets_to_be_committed = {}
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
) -> StreamProcessor[KafkaPayload]:
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
