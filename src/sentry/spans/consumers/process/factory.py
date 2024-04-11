import dataclasses
import logging
from collections.abc import Callable, Mapping
from typing import Any

import sentry_sdk
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from arroyo.backends.kafka.consumer import Headers, KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.produce import Produce
from arroyo.processing.strategies.reduce import Reduce
from arroyo.processing.strategies.unfold import Unfold
from arroyo.types import FILTERED_PAYLOAD, BaseValue, BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.spans.buffer.redis import RedisSpansBuffer
from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)
SPAN_SCHEMA: Codec[SpanEvent] = get_codec("snuba-spans")

BATCH_SIZE = 100


@dataclasses.dataclass
class ProduceSegmentContext:
    should_process_segments: bool
    timestamp: int | None
    partition: int | None


EMPTY_SEGMENT_CONTEXT = ProduceSegmentContext(
    should_process_segments=False, timestamp=None, partition=None
)


def get_project_id(headers: Headers) -> int | None:
    for k, v in headers:
        if k == "project_id":
            return int(v.decode("utf-8"))

    return None


def prepare_buffered_segment_payload(segments) -> bytes:
    segment_str = b",".join(segments)
    return b'{"spans": [' + segment_str + b"]}"


def _deserialize_span(value: bytes) -> Mapping[str, Any]:
    return SPAN_SCHEMA.decode(value)


def _process_message(message: Message[KafkaPayload]) -> ProduceSegmentContext:
    if not options.get("standalone-spans.process-spans-consumer.enable"):
        return EMPTY_SEGMENT_CONTEXT

    try:
        project_id = get_project_id(message.payload.headers)
    except Exception:
        logger.exception("Failed to parse span message header")
        return EMPTY_SEGMENT_CONTEXT

    if project_id is None or project_id not in options.get(
        "standalone-spans.process-spans-consumer.project-allowlist"
    ):
        return EMPTY_SEGMENT_CONTEXT

    assert isinstance(message.value, BrokerValue)

    with sentry_sdk.start_transaction(op="process", name="spans.process.process_message") as txn:
        payload_value = message.payload.value
        timestamp = int(message.value.timestamp.timestamp())
        partition = message.value.partition.index

        with txn.start_child(op="deserialize"):
            span = _deserialize_span(payload_value)

        segment_id = span.get("segment_id", None)
        if segment_id is None:
            return EMPTY_SEGMENT_CONTEXT

        trace_id = span["trace_id"]

        txn.set_tag("trace.id", trace_id)
        txn.set_tag("segment.id", segment_id)
        sentry_sdk.set_measurement("num_keys", len(span))

        client = RedisSpansBuffer()

        should_process_segments = client.write_span_and_check_processing(
            project_id, segment_id, timestamp, partition, payload_value
        )

    return ProduceSegmentContext(
        should_process_segments=should_process_segments, timestamp=timestamp, partition=partition
    )


def process_message(message: Message[KafkaPayload]) -> ProduceSegmentContext:
    try:
        return _process_message(message)
    except Exception:
        sentry_sdk.capture_exception()
        return EMPTY_SEGMENT_CONTEXT


def _accumulator(result: dict[int, ProduceSegmentContext], value: BaseValue[ProduceSegmentContext]):
    context = value.payload
    if not context.should_process_segments:
        return result

    assert context.partition is not None
    assert context.timestamp is not None

    result[context.partition] = context
    return result


def accumulator(
    result: dict[int, ProduceSegmentContext], value: BaseValue[ProduceSegmentContext]
) -> dict[int, ProduceSegmentContext]:
    try:
        return _accumulator(result, value)
    except Exception:
        sentry_sdk.capture_exception()
        return result


def _explode_segments(context_dict: dict[int, ProduceSegmentContext]):
    buffered_segments = []

    for context in context_dict.values():
        if not context.should_process_segments:
            continue

        assert context.partition is not None
        assert context.timestamp is not None

        with sentry_sdk.start_transaction(
            op="process", name="spans.process.explode_segments"
        ) as txn:
            client = RedisSpansBuffer()
            payload_context = {}

            with txn.start_child(op="process", description="fetch_unprocessed_segments"):
                keys = client.get_unprocessed_segments_and_prune_bucket(
                    context.timestamp, context.partition
                )

            sentry_sdk.set_measurement("segments.count", len(keys))
            if len(keys) > 0:
                payload_context["sample_key"] = keys[0]

            # With pipelining, redis server is forced to queue replies using
            # up memory, so batching the keys we fetch.
            with txn.start_child(op="process", description="produce_fetched_segments"):
                for i in range(0, len(keys), BATCH_SIZE):
                    segments = client.read_and_expire_many_segments(keys[i : i + BATCH_SIZE])

                    for segment in segments:
                        if not len(segment):
                            continue

                        payload_data = prepare_buffered_segment_payload(segment)
                        buffered_segments.append(KafkaPayload(None, payload_data, []))

    if not len(buffered_segments):
        return [FILTERED_PAYLOAD]

    return buffered_segments


def explode_segments(context_dict: dict[int, ProduceSegmentContext]):
    try:
        return _explode_segments(context_dict)
    except Exception:
        sentry_sdk.capture_exception()
        return [FILTERED_PAYLOAD]


class ProcessSpansStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
    ):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.__pool = MultiprocessingPool(num_processes)

        cluster_name = get_topic_definition(Topic.BUFFERED_SEGMENTS)["cluster"]

        producer_config = get_kafka_producer_cluster_options(cluster_name)
        producer_config.pop("compression.type", None)
        producer_config.pop("message.max.bytes", None)
        self.producer = KafkaProducer(build_kafka_configuration(default_config=producer_config))
        self.output_topic = ArroyoTopic(
            get_topic_definition(Topic.BUFFERED_SEGMENTS)["real_topic_name"]
        )

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:

        produce_step = Produce(
            producer=self.producer,
            topic=self.output_topic,
            next_step=CommitOffsets(commit),
        )

        unfold_step = Unfold(generator=explode_segments, next_step=produce_step)

        initial_value: Callable[[], dict[int, ProduceSegmentContext]] = lambda: {}
        reduce_step: Reduce[ProduceSegmentContext, dict[int, ProduceSegmentContext]] = Reduce(
            self.max_batch_size,
            self.max_batch_time,
            accumulator,
            initial_value=initial_value,
            next_step=unfold_step,
        )

        return RunTaskWithMultiprocessing(
            function=process_message,
            next_step=reduce_step,
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.__pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def shutdown(self) -> None:
        self.producer.close()
        self.__pool.close()
