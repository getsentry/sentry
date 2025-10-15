import logging
import time
from collections.abc import Callable, Mapping
from functools import partial
from typing import cast

import orjson
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.batching import BatchStep, ValuesBatch
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent

from sentry import killswitches
from sentry.spans.buffer import Span, SpansBuffer
from sentry.spans.consumers.process.flusher import SpanFlusher
from sentry.spans.consumers.process_segments.types import attribute_value
from sentry.utils import metrics
from sentry.utils.arroyo import MultiprocessingPool, SetJoinTimeout, run_task_with_multiprocessing

logger = logging.getLogger(__name__)


class ProcessSpansStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    """
    1. Process spans and push them to redis
    2. Commit offsets for processed spans
    3. Reduce the messages to find the latest timestamp to process
    4. Fetch all segments are two minutes or older and expire the keys so they
       aren't reprocessed
    5. Produce segments to buffered-segments topic
    """

    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
        flusher_processes: int | None = None,
        produce_to_pipe: Callable[[KafkaPayload], None] | None = None,
        kafka_slice_id: int | None = None,
    ):
        super().__init__()

        self.rebalancing_count = 0

        # config
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.num_processes = num_processes
        self.flusher_processes = flusher_processes
        self.produce_to_pipe = produce_to_pipe
        self.kafka_slice_id = kafka_slice_id

        if self.num_processes != 1:
            self.__pool = MultiprocessingPool(num_processes)

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        # TODO: remove once span buffer is live in all regions
        scope = sentry_sdk.get_isolation_scope()
        scope.level = "warning"

        self.rebalancing_count += 1
        sentry_sdk.set_tag("sentry_spans_rebalancing_count", str(self.rebalancing_count))
        sentry_sdk.set_tag("sentry_spans_buffer_component", "consumer")

        committer = CommitOffsets(commit)

        buffer = SpansBuffer(
            assigned_shards=[p.index for p in partitions],
            slice_id=self.kafka_slice_id,
        )

        # patch onto self just for testing
        flusher: ProcessingStrategy[FilteredPayload | int]
        flusher = self._flusher = SpanFlusher(
            buffer,
            next_step=committer,
            max_processes=self.flusher_processes,
            produce_to_pipe=self.produce_to_pipe,
        )

        # The flusher must be given some time to shut down, because otherwise
        # we may double-produce segments.
        flusher = SetJoinTimeout(None, flusher)

        if self.num_processes != 1:
            run_task = run_task_with_multiprocessing(
                function=partial(process_batch, buffer),
                next_step=flusher,
                max_batch_size=self.max_batch_size,
                max_batch_time=self.max_batch_time,
                pool=self.__pool,
                input_block_size=self.input_block_size,
                output_block_size=self.output_block_size,
            )
        else:
            run_task = RunTask(
                function=partial(process_batch, buffer),
                next_step=flusher,
            )

        batch = BatchStep(
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            next_step=run_task,
        )

        def prepare_message(message: Message[KafkaPayload]) -> tuple[int, KafkaPayload]:
            # We use the produce timestamp to drive the clock for flushing, so that
            # consumer backlogs do not cause segments to be flushed prematurely.
            # The received timestamp in the span is too old for this purpose if
            # Relay starts buffering, and we don't want that effect to propagate
            # into this system.
            return (
                int(message.timestamp.timestamp() if message.timestamp else time.time()),
                message.payload,
            )

        add_timestamp = RunTask(
            function=prepare_message,
            next_step=batch,
        )

        # Our entire insertion process into redis is perfectly idempotent. It
        # makes no sense to spend time inserting into redis during rebalancing
        # when we can just parse and batch again.
        return SetJoinTimeout(0.0, add_timestamp)

    def shutdown(self) -> None:
        if self.num_processes != 1:
            self.__pool.close()


@metrics.wraps("spans.buffer.process_batch")
def process_batch(
    buffer: SpansBuffer,
    values: Message[ValuesBatch[tuple[int, KafkaPayload]]],
) -> int:
    killswitch_config = killswitches.get_killswitch_value("spans.drop-in-buffer")
    min_timestamp = None
    decode_time = 0.0
    spans = []

    for value in values.payload:
        assert isinstance(value, BrokerValue)

        try:
            timestamp, payload = value.payload
            if min_timestamp is None or timestamp < min_timestamp:
                min_timestamp = timestamp

            decode_start = time.monotonic()
            val = cast(SpanEvent, orjson.loads(payload.value))
            decode_time += time.monotonic() - decode_start

            if killswitches.value_matches(
                "spans.drop-in-buffer",
                killswitch_config,
                {
                    "org_id": val.get("organization_id"),
                    "project_id": val.get("project_id"),
                    "trace_id": val.get("trace_id"),
                    "partition_id": value.partition.index,
                },
                emit_metrics=False,
            ):
                continue

            # This is a bug in Relay (INC-1453)
            #
            # Add some assertions here to protect against downstream crashes.
            # These will be caught by the wrapping except block. Not doing
            # those assertions here but later will crash the consumer and is
            # also violating mypy types.
            assert val["end_timestamp"] is not None

            span = Span(
                trace_id=val["trace_id"],
                span_id=val["span_id"],
                parent_span_id=val.get("parent_span_id"),
                segment_id=cast(str | None, attribute_value(val, "sentry.segment.id")),
                project_id=val["project_id"],
                payload=payload.value,
                end_timestamp=val["end_timestamp"],
                is_segment_span=bool(val.get("parent_span_id") is None or val.get("is_remote")),
            )
            spans.append(span)

        except Exception:
            logger.exception("spans.invalid-message")
            # We only DLQ when parsing the input for now. All other errors
            # beyond this point are very unlikely to pertain to a specific message:
            #
            # * if we get exceptions from buffer.process_spans, it's likely
            #   because Redis is down entirely.
            # * if we get exceptions from the flusher, it's likely that there
            #   is a broader issue with traffic patterns where no individual
            #   message is at fault.
            #
            # in those situations it's better to halt the consumer as we're
            # otherwise very likely to just DLQ everything anyway.
            raise InvalidMessage(value.partition, value.offset)

    # This timing is not tracked in case of an exception. This is desired
    # because otherwise the ratio with other batch metrics is out of sync.
    metrics.timing("spans.buffer.process_batch.decode", decode_time)

    assert min_timestamp is not None
    buffer.process_spans(spans, now=min_timestamp)
    return min_timestamp
