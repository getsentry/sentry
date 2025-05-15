import logging
from collections.abc import Mapping, MutableMapping
from typing import Any

import orjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.produce import Produce
from arroyo.processing.strategies.unfold import Unfold
from arroyo.types import Commit, FilteredPayload, Message, Partition, Value
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, TraceItem

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.spans.consumers.process_segments.message import process_segment
from sentry.spans.consumers.process_segments.types import Span
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)

# An amortized ceiling of spans per segment used to compute the size of the
# produce buffer. If that buffer fills up, the consumer exercises backpressure.
# We use the 95th percentile, since the average is much lower and equalizes over
# the batches.
#
# NOTE: The true maximum is 1000 at the time of writing.
SPANS_PER_SEG_P95 = 350


class DetectPerformanceIssuesStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
        skip_produce: bool,
    ):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.skip_produce = skip_produce
        self.num_processes = num_processes
        self.pool = MultiprocessingPool(num_processes)

        topic_definition = get_topic_definition(Topic.SNUBA_ITEMS)
        producer_config = get_kafka_producer_cluster_options(topic_definition["cluster"])

        # Due to the unfold step that precedes the producer, this pipeline
        # writes large bursts of spans at once when a batch of segments is
        # finished by the multi processing pool. We size the produce buffer
        # so that it can accommodate batches from all subprocesses at the
        # sime time, assuming some upper bound of spans per segment.
        self.kafka_queue_size = self.max_batch_size * self.num_processes * SPANS_PER_SEG_P95
        producer_config["queue.buffering.max.messages"] = self.kafka_queue_size

        self.producer = KafkaProducer(
            build_kafka_configuration(default_config=producer_config), use_simple_futures=True
        )
        self.output_topic = ArroyoTopic(topic_definition["real_topic_name"])

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        commit_step = CommitOffsets(commit)

        produce_step: ProcessingStrategy[FilteredPayload | KafkaPayload]

        if not self.skip_produce:
            produce_step = Produce(
                producer=self.producer,
                topic=self.output_topic,
                next_step=commit_step,
                max_buffer_size=self.kafka_queue_size,
            )
        else:
            produce_step = commit_step

        unfold_step = Unfold(generator=_unfold_segment, next_step=produce_step)

        return run_task_with_multiprocessing(
            function=_process_message,
            next_step=unfold_step,
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def shutdown(self):
        self.pool.close()


def _process_message(message: Message[KafkaPayload]) -> list[KafkaPayload]:
    if not options.get("standalone-spans.process-segments-consumer.enable"):
        return []

    try:
        value = message.payload.value
        segment = orjson.loads(value)
        processed = process_segment(segment["spans"])
        return [_convert_to_trace_item(span) for span in processed]
    except Exception:  # NOQA
        raise
        # TODO: Implement error handling
        # sentry_sdk.capture_exception()
        # assert isinstance(message.value, BrokerValue)
        # raise InvalidMessage(message.value.partition, message.value.offset)


def _convert_to_trace_item(span: Span) -> KafkaPayload:
    attributes: MutableMapping[str, AnyValue] = {}  # TODO
    for k, v in (span.get("data") or {}).items():
        attributes[k] = v

    client_sample_rate = 1.0
    server_sample_rate = 1.0

    def infer_anyvalue(value: Any) -> AnyValue:
        if isinstance(value, str):
            return AnyValue(string_value=value)

        if isinstance(value, int):
            return AnyValue(int_value=value)

        if isinstance(value, float):
            return AnyValue(double_value=value)

        raise ValueError(f"Unknown value type: {type(value)}")

    for k, v in (span.get("measurements") or {}).items():
        if k is None or v is None:
            continue

        if k == "client_sample_rate":
            client_sample_rate = v["value"]
            continue

        if k == "server_sample_rate":
            server_sample_rate = v["value"]
            continue

        attributes[k] = infer_anyvalue(v)

    for k, v in (span.get("sentry_tags") or {}).items():
        if v is None:
            continue

        if k == "description":
            k = "sentry.normalized_description"
        else:
            k = f"sentry.{k}"

        attributes[k] = infer_anyvalue(v)

    for k, v in (span.get("tags") or {}).items():
        if v is None:
            continue

        attributes[k] = infer_anyvalue(v)

    description = span.get("description")
    if description is not None:
        attributes["sentry.raw_description"] = infer_anyvalue(description)

    attributes["sentry.duration_ms"] = infer_anyvalue(span["duration_ms"])

    event_id = span.get("event_id")
    if event_id is not None:
        attributes["sentry.event_id"] = infer_anyvalue(event_id)

    attributes["sentry.is_segment"] = infer_anyvalue(span["is_segment"])
    exclusive_time_ms = span.get("exclusive_time_ms")
    if exclusive_time_ms is not None:
        attributes["sentry.exclusive_time_ms"] = infer_anyvalue(exclusive_time_ms)
    attributes["sentry.start_timestamp_precise"] = infer_anyvalue(span["start_timestamp_precise"])
    attributes["sentry.end_timestamp_precise"] = infer_anyvalue(span["end_timestamp_precise"])
    attributes["sentry.start_timestamp_ms"] = infer_anyvalue(span["start_timestamp_ms"])
    attributes["sentry.is_remote"] = infer_anyvalue(span["is_remote"])

    parent_span_id = span.get("parent_span_id")
    if parent_span_id is not None:
        attributes["sentry.parent_span_id"] = infer_anyvalue(parent_span_id)

    profile_id = span.get("profile_id")
    if profile_id is not None:
        attributes["sentry.profile_id"] = infer_anyvalue(profile_id)

    segment_id = span.get("segment_id")
    if segment_id is not None:
        attributes["sentry.segment_id"] = infer_anyvalue(segment_id)

    origin = span.get("origin")
    if origin is not None:
        attributes["sentry.origin"] = infer_anyvalue(origin)

    kind = span.get("kind")
    if kind is not None:
        attributes["sentry.kind"] = infer_anyvalue(kind)

    trace_item = TraceItem(
        item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
        organization_id=span["organization_id"],
        project_id=span["project_id"],
        received=Timestamp(seconds=int(span["received"])),  # TODO: more precision?
        retention_days=span["retention_days"],
        timestamp=Timestamp(seconds=int(span["start_timestamp_precise"])),
        trace_id=span["trace_id"],
        item_id=int(span["span_id"], 16).to_bytes(16, "little"),
        attributes=attributes,
        client_sample_rate=client_sample_rate,
        server_sample_rate=server_sample_rate,
    )

    trace_item_bytes = trace_item.SerializeToString()
    return KafkaPayload(
        key=None,
        value=trace_item_bytes,
        headers=[
            ("item_type", b"span"),
            ("project_id", str(span["project_id"]).encode("ascii")),
        ],
    )


def _unfold_segment(spans: list[KafkaPayload]):
    return [Value(span, {}) for span in spans if span is not None]
