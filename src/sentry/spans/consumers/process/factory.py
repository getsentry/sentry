import logging
import time
from collections.abc import Callable, Mapping
from functools import partial

import rapidjson
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.batching import BatchStep, ValuesBatch
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, FilteredPayload, Message, Partition

from sentry.spans.buffer import Span, SpansBuffer
from sentry.spans.consumers.process.flusher import SpanFlusher
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing
from sentry.utils.safe import get_path

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
        max_flush_segments: int,
        input_block_size: int | None,
        output_block_size: int | None,
        produce_to_pipe: Callable[[KafkaPayload], None] | None = None,
    ):
        super().__init__()

        # config
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.max_flush_segments = max_flush_segments
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.num_processes = num_processes
        self.produce_to_pipe = produce_to_pipe

        if self.num_processes != 1:
            self.__pool = MultiprocessingPool(num_processes)

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        committer = CommitOffsets(commit)

        buffer = SpansBuffer(assigned_shards=[p.index for p in partitions])

        # patch onto self just for testing
        flusher: ProcessingStrategy[FilteredPayload | int]

        flusher = self._flusher = SpanFlusher(
            buffer,
            self.max_flush_segments,
            self.produce_to_pipe,
            next_step=committer,
        )

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

        # We use the produce timestamp to drive the clock for flushing, so that
        # consumer backlogs do not cause segments to be flushed prematurely.
        # The received timestamp in the span is too old for this purpose if
        # Relay starts buffering, and we don't want that effect to propagate
        # into this system.
        def add_produce_timestamp_cb(message: Message[KafkaPayload]) -> tuple[int, KafkaPayload]:
            return (
                int(message.timestamp.timestamp() if message.timestamp else time.time()),
                message.payload,
            )

        add_timestamp = RunTask(
            function=add_produce_timestamp_cb,
            next_step=batch,
        )

        return add_timestamp

    def shutdown(self) -> None:
        if self.num_processes != 1:
            self.__pool.close()


def process_batch(
    buffer: SpansBuffer, values: Message[ValuesBatch[tuple[int, KafkaPayload]]]
) -> int:
    min_timestamp = None
    spans = []
    for value in values.payload:
        timestamp, payload = value.payload
        if min_timestamp is None or timestamp < min_timestamp:
            min_timestamp = timestamp

        val = rapidjson.loads(payload.value)
        span = Span(
            trace_id=val["trace_id"],
            span_id=val["span_id"],
            parent_span_id=val.get("parent_span_id"),
            project_id=val["project_id"],
            payload=payload.value,
            # TODO: validate, this logic may not be complete.
            is_segment_span=(
                val.get("parent_span_id") is None
                or get_path(val, "sentry_tags", "op") == "http.server"
                or val.get("is_remote")
            ),
        )
        spans.append(span)

    assert min_timestamp is not None
    buffer.process_spans(spans, now=min_timestamp)
    return min_timestamp
