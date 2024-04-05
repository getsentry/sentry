import dataclasses
import logging
import random
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from arroyo.backends.kafka.consumer import Headers, KafkaPayload
from arroyo.processing.strategies import RunTask
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry import options
from sentry.spans.buffer.redis import RedisSpansBuffer
from sentry.spans.produce_segment import produce_segment_to_kafka
from sentry.utils import metrics
from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing

logger = logging.getLogger(__name__)
SPAN_SCHEMA: Codec[SpanEvent] = get_codec("snuba-spans")

BATCH_SIZE = 100


@dataclasses.dataclass
class ProduceSegmentContext:
    should_process_segments: bool
    timestamp: int
    partition: int


def get_project_id(headers: Headers) -> int | None:
    for k, v in headers:
        if k == "project_id":
            return int(v.decode("utf-8"))

    return None


def _deserialize_span(value: bytes) -> Mapping[str, Any]:
    return SPAN_SCHEMA.decode(value)


def _process_message(message: Message[KafkaPayload]) -> ProduceSegmentContext | None:
    if not options.get("standalone-spans.process-spans-consumer.enable"):
        return None

    try:
        project_id = get_project_id(message.payload.headers)
    except Exception:
        logger.exception("Failed to parse span message header")
        return None

    if project_id is None or project_id not in options.get(
        "standalone-spans.process-spans-consumer.project-allowlist"
    ):
        return None

    assert isinstance(message.value, BrokerValue)
    metrics.incr("process_spans.spans.received.count")

    with sentry_sdk.start_transaction(op="process", name="spans.process.process_message") as txn:
        payload_value = message.payload.value
        timestamp = int(message.value.timestamp.timestamp())
        partition = message.value.partition.index

        if random.random() < 0.005:
            sentry_sdk.set_context("payload", {"value": str(payload_value)})
            txn.set_tag("has_payload", True)

        span = _deserialize_span(payload_value)
        segment_id = span["segment_id"]
        trace_id = span["trace_id"]

        txn.set_tag("trace.id", trace_id)
        txn.set_tag("segment.id", segment_id)
        sentry_sdk.set_measurement("num_keys", len(span))

        client = RedisSpansBuffer()

        should_process_segments = client.write_span_and_check_processing(
            project_id, segment_id, timestamp, partition, payload_value
        )

        metrics.incr("process_spans.spans.write.count")

    return ProduceSegmentContext(
        should_process_segments=should_process_segments, timestamp=timestamp, partition=partition
    )


def process_message(message: Message[KafkaPayload]) -> ProduceSegmentContext | None:
    try:
        return _process_message(message)
    except Exception:
        sentry_sdk.capture_exception()
        return None


def _produce_segment(message: Message[ProduceSegmentContext | None]):
    if message.payload is None:
        return

    context: ProduceSegmentContext = message.payload

    if context.should_process_segments:
        with sentry_sdk.start_transaction(
            op="process", name="spans.process.produce_segment"
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

            sample_span = None
            total_spans_read = 0
            # With pipelining, redis server is forced to queue replies using
            # up memory, so batching the keys we fetch.
            with txn.start_child(op="process", description="produce_fetched_segments"):
                for i in range(0, len(keys), BATCH_SIZE):
                    segments = client.read_and_expire_many_segments(keys[i : i + BATCH_SIZE])

                    for segment in segments:
                        total_spans_read += len(segment)
                        if len(segment) > 0:
                            sample_span = segment[0]
                        produce_segment_to_kafka(segment)

            metrics.incr("process_spans.spans.read.count", total_spans_read)
            if sample_span and random.random() < 0.01:
                txn.set_tag("has_payload", True)
                payload_context["sample_span"] = str(sample_span)

            sentry_sdk.set_context("payload", payload_context)


def produce_segment(message: Message[ProduceSegmentContext | None]):
    try:
        _produce_segment(message)
    except Exception:
        sentry_sdk.capture_exception()


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
        self.pool = MultiprocessingPool(num_processes)

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        next_step = RunTask(function=produce_segment, next_step=CommitOffsets(commit))

        return RunTaskWithMultiprocessing(
            function=process_message,
            next_step=next_step,
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )
