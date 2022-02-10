import functools
import logging
import time
from collections import deque
from concurrent.futures import Future
from copy import deepcopy
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Deque,
    List,
    Mapping,
    MutableMapping,
    NamedTuple,
    Optional,
    Set,
    Union,
)

from arroyo.backends.abstract import Producer as AbstractProducer
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload, KafkaProducer
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import MessageRejected
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies import ProcessingStrategy as ProcessingStep
from arroyo.processing.strategies import ProcessingStrategyFactory
from arroyo.processing.strategies.streaming.collect import CollectStep
from arroyo.processing.strategies.streaming.transform import ParallelTransformStep
from arroyo.types import Message, Partition, Position, Topic
from confluent_kafka import Producer
from django.conf import settings

from sentry.utils import json, kafka_config

DEFAULT_QUEUED_MAX_MESSAGE_KBYTES = 50000
DEFAULT_QUEUED_MIN_MESSAGES = 100000

logger = logging.getLogger(__name__)

MessageBatch = List[Message[KafkaPayload]]


def initializer() -> None:
    from sentry.runner import configure

    configure()


@functools.lru_cache(maxsize=10)
def get_indexer():  # type: ignore
    from sentry.sentry_metrics import indexer

    return indexer


@functools.lru_cache(maxsize=10)
def get_metrics():  # type: ignore
    from sentry.utils import metrics

    return metrics


def get_config(topic: str, group_id: str, auto_offset_reset: str) -> MutableMapping[Any, Any]:
    cluster_name: str = settings.KAFKA_TOPICS[topic]["cluster"]
    consumer_config: MutableMapping[Any, Any] = kafka_config.get_kafka_consumer_cluster_options(
        cluster_name,
        override_params={
            "enable.auto.commit": False,
            "enable.auto.offset.store": False,
            "group.id": group_id,
            "default.topic.config": {"auto.offset.reset": auto_offset_reset},
            # overridden to reduce memory usage when there's a large backlog
            "queued.max.messages.kbytes": DEFAULT_QUEUED_MAX_MESSAGE_KBYTES,
            "queued.min.messages": DEFAULT_QUEUED_MIN_MESSAGES,
        },
    )
    return consumer_config


class DuplicateMessage(Exception):
    pass


class MetricsBatchBuilder:
    """
    Batches up individual messages - type: Message[KafkaPayload] - into a
    list, which will later be the payload for the big outer message
    that gets passed through to the ParallelTransformStep.

    See `__flush` method of BatchMessages for when that happens.
    """

    def __init__(self, max_batch_size: int, max_batch_time: float) -> None:
        self.__messages: MessageBatch = []
        self.__max_batch_size = max_batch_size
        self.__deadline = time.time() + max_batch_time
        self.__offsets: Set[int] = set()

    def __len__(self) -> int:
        return len(self.__messages)

    @property
    def messages(self) -> MessageBatch:
        return self.__messages

    def append(self, message: Message[KafkaPayload]) -> None:
        if message.offset in self.__offsets:
            raise DuplicateMessage
        self.__messages.append(message)
        self.__offsets.add(message.offset)

    def ready(self) -> bool:
        if len(self.messages) >= self.__max_batch_size:
            return True
        elif time.time() >= self.__deadline:
            return True
        else:
            return False


class BatchMessages(ProcessingStep[KafkaPayload]):  # type: ignore
    """
    First processing step in the MetricsConsumerStrategyFactory.
    Keeps track of a batch of messages (using the MetricsBatchBuilder)
    and then when at capacity, either max_batch_time or max_batch_size,
    flushes the batch.

    Flushing the batch here means wrapping the batch in a Message, the batch
    itself being the payload. This is what the ParallelTransformStep will
    process in the process_message function.
    """

    def __init__(
        self,
        next_step: ProcessingStrategy[MessageBatch],
        max_batch_time: float,
        max_batch_size: int,
    ):
        self.__max_batch_size = max_batch_size
        self.__max_batch_time = max_batch_time

        self.__next_step = next_step
        self.__batch: Optional[MetricsBatchBuilder] = None
        self.__closed = False

    def poll(self) -> None:
        assert not self.__closed

        self.__next_step.poll()

        if self.__batch and self.__batch.ready():
            try:
                self.__flush()
            except MessageRejected:
                # Probably means that we have received back pressure due to the
                # ParallelTransformStep.
                logger.debug("Attempt to flush batch failed...Re-trying in next poll")
                pass

    def submit(self, message: Message[KafkaPayload]) -> None:
        if self.__batch is None:
            self.__batch = MetricsBatchBuilder(self.__max_batch_size, self.__max_batch_time)

        try:
            self.__batch.append(message)
        except DuplicateMessage:
            # If we are getting back pressure from the next_step (ParallelTransformStep),
            # the consumer will keep trying to submit the same carried over message
            # until it succeeds and stops throwing the MessageRejected error. In this
            # case we don't want to keep adding the same message to the batch over and
            # over again
            logger.debug(f"Message already added to batch with offset: {message.offset}")
            pass

        if self.__batch and self.__batch.ready():
            self.__flush()

    def __flush(self) -> None:
        if not self.__batch:
            return
        last = self.__batch.messages[-1]

        new_message = Message(last.partition, last.offset, self.__batch.messages, last.timestamp)

        self.__next_step.submit(new_message)
        self.__batch = None

    def terminate(self) -> None:
        self.__closed = True
        self.__next_step.terminate()

    def close(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float] = None) -> None:
        if self.__batch:
            last = self.__batch.messages[-1]
            logger.debug(
                f"Abandoning batch of {len(self.__batch)} messages...latest offset: {last.offset}"
            )

        self.__next_step.close()
        self.__next_step.join(timeout)


if TYPE_CHECKING:

    class ProducerResultFuture(NamedTuple):
        message: Message[KafkaPayload]
        future: Future[Message[KafkaPayload]]


else:

    class ProducerResultFuture(NamedTuple):
        message: Message[KafkaPayload]
        future: Future


class ProduceStep(ProcessingStep[MessageBatch]):  # type: ignore
    """
    Step that produces to the snuba-metrics topic, collecting the futures returned by
    the producer. Continously checks to see if futures are done, and once that's the case
    can commit up to the last future that is done.
    """

    def __init__(
        self,
        commit_function: Callable[[Mapping[Partition, Position]], None],
        producer: Optional[AbstractProducer] = None,
    ) -> None:
        if not producer:
            snuba_metrics = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS]
            snuba_metrics_producer = KafkaProducer(
                kafka_config.get_kafka_producer_cluster_options(snuba_metrics["cluster"]),
            )
            producer = snuba_metrics_producer
        self.__producer = producer
        self.__producer_topic = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS].get(
            "topic", "snuba-metrics"
        )
        self.__commit_function = commit_function

        self.__futures: Deque[ProducerResultFuture] = deque()
        self.__closed = False

        # TODO(meredith): make this an option to pass in
        self.__max_buffer_size = 10000

        # XXX(meredith): This is only temporary to record how much
        # time we spend committing when we commit once per message
        # instead of batching commits
        self.__commit_start = time.time()
        self.__commit_duration_sum = 0.0
        self.__metrics = get_metrics()

    def poll(self) -> None:
        while self.__futures:
            if not self.__futures[0].future.done():
                break

            result_future = self.__futures.popleft()
            message, future = result_future

            try:
                future.result()
            except Exception:
                # TODO(meredith): log info for the different errors
                # that could happen:
                # * CancelledError (future was cancelled)
                # * TimeoutError (future timedout)
                # * Exception (the future call raised an exception)
                raise
            start = time.time()
            self.__commit_function({message.partition: Position(message.offset, message.timestamp)})
            end = time.time()
            commit_duration = end - start
            self._record_commit_duration(commit_duration)

    def _record_commit_duration(self, commit_duration: float) -> None:
        self.__commit_duration_sum += commit_duration

        # record commit durations every 5 seconds
        if (self.__commit_start + 5) < time.time():
            self.__metrics.incr(
                "produce_step.commit_duration", amount=int(self.__commit_duration_sum)
            )
            self.__commit_duration_sum = 0
            self.__commit_start = time.time()

    def submit(self, outer_message: Message[MessageBatch]) -> None:
        assert not self.__closed

        if len(self.__futures) >= self.__max_buffer_size:
            raise MessageRejected

        for message in outer_message.payload:
            payload = message.payload
            future = self.__producer.produce(
                destination=Topic(self.__producer_topic),
                payload=payload,
            )
            self.__futures.append(ProducerResultFuture(message, future))

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.__closed = True

        self.__producer.close()

    def join(self, timeout: Optional[float] = None) -> None:
        start = time.time()
        while self.__futures:
            remaining = timeout - (time.time() - start) if timeout is not None else None
            if remaining is not None and remaining <= 0:
                logger.warning(f"Timed out with {len(self.__futures)} futures in queue")
                break

            message, future = self.__futures.popleft()

            future.result(remaining)

            self.__commit_function({message.partition: Position(message.offset, message.timestamp)})
        self.__producer.close()


def process_messages(
    outer_message: Message[MessageBatch],
) -> MessageBatch:
    """
    We have an outer_message Message() whose payload is a batch of Message() objects.

        Message(
            partition=...,
            offset=...
            timestamp=...
            payload=[Message(...), Message(...), etc]
        )

    The inner messages payloads are KafkaPayload's that have:
        * key
        * headers
        * value

    The value of the message is what we need to parse and then translate
    using the indexer.
    """
    indexer = get_indexer()
    metrics = get_metrics()

    strings = set()
    with metrics.timer("process_messages.parse_outer_message"):
        parsed_payloads_by_offset = {
            msg.offset: json.loads(msg.payload.value.decode("utf-8"), use_rapid_json=True)
            for msg in outer_message.payload
        }

        for message in parsed_payloads_by_offset.values():
            metric_name = message["name"]
            tags = message.get("tags", {})

            parsed_strings = {
                metric_name,
                *tags.keys(),
                *tags.values(),
            }
            strings.update(parsed_strings)

    metrics.incr("process_messages.total_strings_indexer_lookup", amount=len(strings))

    with metrics.timer("metrics_consumer.bulk_record"):
        mapping = indexer.bulk_record(list(strings))

    new_messages: List[Message[KafkaPayload]] = []

    with metrics.timer("process_messages.reconstruct_messages"):
        for message in outer_message.payload:
            parsed_payload_value = parsed_payloads_by_offset[message.offset]
            new_payload_value = deepcopy(parsed_payload_value)

            metric_name = parsed_payload_value["name"]
            tags = parsed_payload_value.get("tags", {})

            new_tags: Mapping[int, int] = {mapping[k]: mapping[v] for k, v in tags.items()}

            new_payload_value["tags"] = new_tags
            new_payload_value["metric_id"] = mapping[metric_name]
            new_payload_value["retention_days"] = 90

            del new_payload_value["name"]

            new_payload = KafkaPayload(
                key=message.payload.key,
                value=json.dumps(new_payload_value).encode(),
                headers=message.payload.headers,
            )
            new_message = Message(
                partition=message.partition,
                offset=message.offset,
                payload=new_payload,
                timestamp=message.timestamp,
            )
            new_messages.append(new_message)

    metrics.incr("metrics_consumer.process_message.messages_seen", amount=len(new_messages))

    return new_messages


class MetricsConsumerStrategyFactory(ProcessingStrategyFactory):  # type: ignore
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: float,
        processes: int,
        input_block_size: int,
        output_block_size: int,
    ):
        self.__max_batch_time = max_batch_time
        self.__max_batch_size = max_batch_size

        self.__processes = processes

        self.__input_block_size = input_block_size
        self.__output_block_size = output_block_size

    def create(
        self, commit: Callable[[Mapping[Partition, Position]], None]
    ) -> ProcessingStrategy[KafkaPayload]:

        parallel_strategy = ParallelTransformStep(
            process_messages,
            ProduceStep(commit),
            self.__processes,
            max_batch_size=self.__max_batch_size,
            max_batch_time=self.__max_batch_time,
            input_block_size=self.__input_block_size,
            output_block_size=self.__output_block_size,
            initializer=initializer,
        )

        strategy = BatchMessages(parallel_strategy, self.__max_batch_time, self.__max_batch_size)

        return strategy


class BatchConsumerStrategyFactory(ProcessingStrategyFactory):  # type: ignore
    """
    Batching Consumer Strategy
    """

    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: float,
        commit_max_batch_size: int,
        commit_max_batch_time: float,
    ):
        self.__max_batch_time = max_batch_time
        self.__max_batch_size = max_batch_size
        self.__commit_max_batch_time = commit_max_batch_time
        self.__commit_max_batch_size = commit_max_batch_size

    def create(
        self, commit: Callable[[Mapping[Partition, Position]], None]
    ) -> ProcessingStrategy[KafkaPayload]:
        last_step = CollectStep(
            step_factory=SimpleProduceStep,
            commit_function=commit,
            max_batch_size=self.__commit_max_batch_size,
            # convert to seconds
            max_batch_time=self.__commit_max_batch_time / 1000,
        )
        transform_step = TransformStep(next_step=last_step)
        strategy = BatchMessages(transform_step, self.__max_batch_time, self.__max_batch_size)
        return strategy


class TransformStep(ProcessingStep[MessageBatch]):  # type: ignore
    """
    Temporary Transform Step
    """

    def __init__(
        self,
        next_step: ProcessingStep[KafkaPayload],
    ) -> None:
        self.__process_messages = process_messages
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


class SimpleProduceStep(ProcessingStep[KafkaPayload]):  # type: ignore
    def __init__(
        self,
    ) -> None:
        snuba_metrics = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS]
        snuba_metrics_producer = Producer(
            kafka_config.get_kafka_producer_cluster_options(snuba_metrics["cluster"]),
        )
        producer = snuba_metrics_producer
        self.__producer = producer
        self.__producer_topic = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS].get(
            "topic", "snuba-metrics"
        )

        self.__closed = False
        self.__metrics = get_metrics()

    def poll(self) -> None:
        pass

    def submit(self, message: Message[KafkaPayload]) -> None:
        self.__producer.produce(
            topic=self.__producer_topic,
            key=None,
            value=message.payload.value,
            on_delivery=self.callback,
        )

    def callback(self, error: Any, message: Any) -> None:
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
            messages_left = self.__producer.flush(timeout)

            if messages_left != 0:
                self.__metrics.incr("simple_produce_step.messages_left", amount=messages_left)
                # lets try one more time to flush any last messages
                unflushed_messages = self.__producer.flush(timeout)
                if unflushed_messages != 0:
                    raise UnflushedMessages(
                        f"There are still {unflushed_messages} unflushed messages left."
                    )


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
    **options: Mapping[str, Union[str, int]],
) -> StreamProcessor:

    if factory_name == "multiprocess":
        processing_factory = MetricsConsumerStrategyFactory(
            max_batch_size=max_batch_size,
            max_batch_time=max_batch_time,
            processes=processes,
            input_block_size=input_block_size,
            output_block_size=output_block_size,
        )
    else:
        assert factory_name == "default"
        processing_factory = BatchConsumerStrategyFactory(
            max_batch_size=max_batch_size,
            max_batch_time=max_batch_time,
            commit_max_batch_size=commit_max_batch_size,
            commit_max_batch_time=commit_max_batch_time,
        )

    return StreamProcessor(
        KafkaConsumer(get_config(topic, group_id, auto_offset_reset)),
        Topic(topic),
        processing_factory,
    )
