import functools
import logging
import time
from collections import deque
from concurrent.futures import Future
from typing import (
    Any,
    Callable,
    Deque,
    Dict,
    Generic,
    List,
    Mapping,
    MutableMapping,
    NamedTuple,
    Optional,
    Sequence,
    TypeVar,
)

from arroyo.backends.kafka import KafkaConsumer, KafkaPayload, KafkaProducer
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import MessageRejected
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies import ProcessingStrategy as ProcessingStep
from arroyo.processing.strategies import ProcessingStrategyFactory
from arroyo.processing.strategies.streaming.transform import ParallelTransformStep
from arroyo.types import Message, Partition, Position, Topic
from django.conf import settings

from sentry.utils import json, kafka_config

TPayload = TypeVar("TPayload")
TProcessed = TypeVar("TProcessed")

DEFAULT_QUEUED_MAX_MESSAGE_KBYTES = 50000
DEFAULT_QUEUED_MIN_MESSAGES = 10000

logger = logging.getLogger(__name__)


def initializer():
    from sentry.runner import configure

    configure()


def get_config(topic: str, **options) -> MutableMapping[str, Any]:
    consumer_config = kafka_config.get_kafka_consumer_cluster_options(
        "default",
        override_params={
            "enable.auto.commit": False,
            "enable.auto.offset.store": False,
            "group.id": "ingest-metrics-consumer",
            "default.topic.config": {"auto.offset.reset": "latest"},
            # overridden to reduce memory usage when there's a large backlog
            "queued.max.messages.kbytes": DEFAULT_QUEUED_MAX_MESSAGE_KBYTES,
            "queued.min.messages": DEFAULT_QUEUED_MIN_MESSAGES,
        },
    )
    return consumer_config


class MetricsBatchBuilder(Generic[TPayload]):
    def __init__(self, max_batch_size: int, max_batch_time: float) -> None:
        self.__messages = []
        self.__max_batch_size = max_batch_size
        self.__deadline = time.time() + max_batch_time

    def __len__(self) -> int:
        return len(self.__messages)

    @property
    def messages(self):
        return self.__messages

    def append(self, message: TPayload) -> None:
        self.__messages.append(message)

    def ready(self) -> bool:
        if len(self.messages) >= self.__max_batch_size:
            return True
        elif time.time() >= self.__deadline:
            return True
        else:
            return False


class BatchMessages(ProcessingStep[TPayload]):
    def __init__(
        self,
        next_step: ProcessingStrategy[TProcessed],
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
            self.__flush()

    def submit(self, message: TPayload) -> None:
        if self.__batch is None:
            self.__batch = MetricsBatchBuilder(self.__max_batch_size, self.__max_batch_time)

        self.__batch.append(message)

    def __flush(self) -> None:
        if not self.__batch:
            return
        last = self.__batch.messages[-1]

        new_message = Message(last.partition, last.offset, self.__batch.messages, last.timestamp)

        self.__next_step.submit(new_message)
        self.__batch = None

    def terminate(self) -> None:
        self.__closed = True

    def close(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float] = None) -> None:
        self.__next_step.join(timeout)


class ProducerResultFuture(NamedTuple):
    message: Message[KafkaPayload]
    future: Future


class ProduceStep(ProcessingStep):
    """
    Step that produces to the snuba-metrics topic, collecting the futures returned by
    the producer. Continously checks to see if futures are done, and once that's the case
    can commit up to the last future that is done.
    """

    def __init__(self, commit_function: Callable[[Mapping[Partition, Position]], None]) -> None:
        snuba_metrics = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS]
        snuba_metrics_producer = KafkaProducer(
            kafka_config.get_kafka_producer_cluster_options(snuba_metrics["cluster"]),
        )
        self.__producer = snuba_metrics_producer
        self.__producer_topic = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS].get(
            "topic", "snuba-metrics"
        )
        self.__commit_function = commit_function

        self.__futures: Deque[ProducerResultFuture] = deque()
        self.__closed = False

        # TODO(meredith): make this an option to pass in
        self.__max_buffer_size = 10000

    def poll(self) -> None:
        while self.__futures:
            if not self.__futures[0].future.done():
                break

            result_future = self.__futures.popleft()
            message, future = result_future

            try:
                future.result()
            except Exception:
                # TODO(meredith): log info for the differenc errors
                # that could happen:
                # * CancelledError (future was cancelled)
                # * TimeoutError (future timedout)
                # * Exception (the fucture call raised an exception)
                raise
            self.__commit_function({message.partition: Position(message.offset, message.timestamp)})

    def submit(self, outer_message: Message[TPayload]) -> None:
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


def produce_step(commit_function: Callable[[Mapping[Partition, Position]], None]):
    return ProduceStep(commit_function)


@functools.lru_cache(maxsize=10)
def get_indexer():
    from sentry.sentry_metrics import indexer

    return indexer


def process_messages(outer_message: Message[TPayload]) -> List[Message[TPayload]]:
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

    strings = set()
    parsed_payloads_by_offset = {
        msg.offset: json.loads(msg.payload.value, use_rapid_json=True)
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

    mapping = indexer.bulk_record(list(strings))  # type: ignore

    new_messages: Sequence[Message[KafkaPayload]] = []

    for message in outer_message.payload:
        parsed_payload_value = parsed_payloads_by_offset[message.offset]
        new_payload_value = parsed_payload_value

        metric_name = parsed_payload_value["name"]
        tags = parsed_payload_value.get("tags", {})

        new_tags = {mapping[k]: mapping[v] for k, v in tags.items()}

        new_payload_value["tags"] = new_tags
        new_payload_value["metric_id"] = mapping[metric_name]
        new_payload_value["retention_days"] = 90

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

    # TODO(meredith): Need to add kickin off the celery task in here, eventually
    # we will use kafka to forward messages to the product data model
    # messages = [
    #     {"tags": m.payload["tags"], "name": m.payload["name"], "org_id": m.payload["org_id"]}
    #     for m in self.__messages
    # ]
    # process_indexed_metrics.apply_async(kwargs={"messages": messages})

    return new_messages


class MetricsConsumerStrategyFactory(ProcessingStrategyFactory):
    def __init__(
        self,
        process_messages: Callable[[Message[TPayload]], TProcessed],
        next_step: Callable[
            [Callable[[Mapping[Partition, Position]], None]], ProcessingStrategy[TProcessed]
        ],
        max_batch_size: int,
        max_batch_time: float,
        processes: int,
        input_block_size: int,
        output_block_size: int,
        initialize_parallel_transform: Optional[Callable[[], None]] = None,
    ):
        self.__process_messages = process_messages
        self.__next_step = next_step

        self.__max_batch_time = max_batch_time
        self.__max_batch_size = max_batch_size

        self.__processes = processes

        self.__input_block_size = input_block_size
        self.__output_block_size = output_block_size

        self.__initialize_parallel_transform = initialize_parallel_transform

    def create(
        self, commit: Callable[[Mapping[Partition, Position]], None]
    ) -> ProcessingStrategy[TPayload]:
        transform_function = self.__process_messages

        parallel_strategy = ParallelTransformStep(
            transform_function,
            self.__next_step(commit),
            self.__processes,
            max_batch_size=self.__max_batch_size,
            max_batch_time=self.__max_batch_time,
            input_block_size=self.__input_block_size,
            output_block_size=self.__output_block_size,
            initializer=self.__initialize_parallel_transform,
        )

        strategy = BatchMessages(parallel_strategy, self.__max_batch_time, self.__max_batch_size)

        return strategy


def get_streaming_metrics_consumer(topic: str, **options: Dict[str, str]) -> StreamProcessor:
    DEFAULT_BLOCK_SIZE = int(32 * 1e6)
    processing_factory = MetricsConsumerStrategyFactory(
        process_messages,
        produce_step,
        max_batch_size=2,
        max_batch_time=1000.0,
        processes=1,
        input_block_size=DEFAULT_BLOCK_SIZE,
        output_block_size=DEFAULT_BLOCK_SIZE,
        initialize_parallel_transform=initializer,
    )
    return StreamProcessor(
        KafkaConsumer(get_config(topic, **options)),
        Topic(topic),
        processing_factory,
    )
