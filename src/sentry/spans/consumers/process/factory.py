import logging
import time
from collections.abc import Mapping
from functools import partial

import msgspec
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.batching import BatchStep, ValuesBatch
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition

from sentry import killswitches
from sentry.spans.buffer import SpansBuffer
from sentry.spans.buffer_types import Span
from sentry.spans.consumers.process.flusher import ProduceToPipe, SpanFlusher
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
        produce_to_pipe: ProduceToPipe | None = None,
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
        sentry_sdk.set_attribute("sentry_spans_rebalancing_count", str(self.rebalancing_count))
        sentry_sdk.set_tag("sentry_spans_buffer_component", "consumer")
        sentry_sdk.set_attribute("sentry_spans_buffer_component", "consumer")

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
                function=partial(
                    process_batch,
                    buffer,
                ),
                next_step=flusher,
                max_batch_size=self.max_batch_size,
                max_batch_time=self.max_batch_time,
                pool=self.__pool,
                input_block_size=self.input_block_size,
                output_block_size=self.output_block_size,
            )
        else:
            run_task = RunTask(
                function=partial(
                    process_batch,
                    buffer,
                ),
                next_step=flusher,
                better_backpressure=True,
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

            # Decoding into the typed struct validates the fields the buffer relies on (presence
            # and types); malformed spans raise here and are routed to the DLQ below. See also:
            # INC-1453, INC-1458.
            decode_start = time.monotonic()
            span_event = _PROCESS_SPAN_DECODER.decode(payload.value)
            decode_time += time.monotonic() - decode_start

            if killswitches.value_matches(
                "spans.drop-in-buffer",
                killswitch_config,
                {
                    "org_id": span_event.organization_id,
                    "project_id": span_event.project_id,
                    "trace_id": span_event.trace_id,
                    "partition_id": value.partition.index,
                },
                emit_metrics=False,
            ):
                continue

            span = Span(
                trace_id=span_event.trace_id,
                span_id=span_event.span_id,
                parent_span_id=span_event.parent_span_id,
                segment_id=span_event.segment_id,
                project_id=span_event.project_id,
                payload=payload.value,
                is_segment_span=span_event.is_segment_span,
                partition=value.partition.index,
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


class SpanAttributeValue(msgspec.Struct, gc=False):
    value: str | None = None


class SpanAttributes(msgspec.Struct, gc=False):
    segment_id: SpanAttributeValue | None = msgspec.field(name="sentry.segment.id", default=None)


class ProcessSpanEvent(msgspec.Struct, gc=False):
    organization_id: int
    project_id: int
    trace_id: str
    span_id: str
    start_timestamp: float
    end_timestamp: float
    received: float
    retention_days: int
    status: str
    name: str | None = None
    parent_span_id: str | None = None
    is_segment: bool | None = None
    attributes: SpanAttributes | None = None

    @property
    def segment_id(self) -> str | None:
        if self.attributes is None or self.attributes.segment_id is None:
            return None
        return self.attributes.segment_id.value

    @property
    def is_segment_span(self) -> bool:
        return self.parent_span_id is None or bool(self.is_segment)


_PROCESS_SPAN_DECODER = msgspec.json.Decoder(type=ProcessSpanEvent)


def decode_process_span_event(buf: bytes) -> ProcessSpanEvent:
    return _PROCESS_SPAN_DECODER.decode(buf)
