import dataclasses
import logging
import time
from collections.abc import Mapping
from functools import partial
from typing import Any

import orjson
import rapidjson
import sentry_sdk
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from arroyo.backends.kafka.consumer import Headers, KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.batching import BatchStep, ValuesBatch
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import FILTERED_PAYLOAD, BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.spans.buffer_v2 import RedisSpansBuffer, Span
from sentry.spans.consumers.process.flusher import SpanFlusher
from sentry.utils import metrics
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

SPANS_CODEC: Codec[SpanEvent] = get_topic_codec(Topic.INGEST_SPANS)
MAX_PAYLOAD_SIZE = 10 * 1000 * 1000  # 10 MB

BATCH_SIZE = 100


def in_process_spans_rollout_group(project_id: int | None) -> bool:
    if project_id and project_id in options.get(
        "standalone-spans.process-spans-consumer.project-allowlist"
    ):
        return True

    if project_id and (project_id % 100000) / 100000 < options.get(
        "standalone-spans.process-spans-consumer.project-rollout"
    ):
        return True
    return False


@dataclasses.dataclass
class SpanMessageWithMetadata:
    segment_id: str
    project_id: int
    timestamp: int
    partition: int
    span: bytes


def get_project_id(headers: Headers) -> int | None:
    for k, v in headers:
        if k == "project_id":
            return int(v.decode("utf-8"))

    return None


def prepare_buffered_segment_payload(segments) -> bytes:
    segment_str = b",".join(segments)
    return b'{"spans": [' + segment_str + b"]}"


@metrics.wraps("spans.consumers.process.deserialize_span")
def _deserialize_span(value: bytes, use_orjson=False, use_rapidjson=False) -> Mapping[str, Any]:
    if use_orjson:
        sentry_sdk.set_tag("json_lib", "orjson")
        return orjson.loads(value)
    if use_rapidjson:
        sentry_sdk.set_tag("json_lib", "rapidjson")
        return rapidjson.loads(value)

    return SPANS_CODEC.decode(value)


def _process_message(message: Message[KafkaPayload]) -> SpanMessageWithMetadata | FilteredPayload:
    """
    Deserializes span to get segment_id. Returns `SpanMessageWithMetadata` which contains the
    original span payload value in bytes along with other segment_id, message timestamp and
    partition data to ensure correct bucketing in redis.
    """
    if not options.get("standalone-spans.process-spans-consumer.enable"):
        return FILTERED_PAYLOAD

    try:
        project_id = get_project_id(message.payload.headers)
    except Exception:
        logger.exception("Failed to parse span message header")
        return FILTERED_PAYLOAD

    if not project_id or not in_process_spans_rollout_group(project_id=project_id):
        return FILTERED_PAYLOAD

    assert isinstance(message.value, BrokerValue)

    with sentry_sdk.start_transaction(op="process", name="spans.process.process_message") as txn:
        payload_value = message.payload.value
        timestamp = int(message.value.timestamp.timestamp())
        partition = message.value.partition.index

        use_orjson = options.get("standalone-spans.deserialize-spans-orjson.enable")
        use_rapidjson = options.get("standalone-spans.deserialize-spans-rapidjson.enable")

        with txn.start_child(op="deserialize"):
            span = _deserialize_span(
                payload_value, use_orjson=use_orjson, use_rapidjson=use_rapidjson
            )

        segment_id: str | None = span.get("segment_id", None)
        if segment_id is None:
            return FILTERED_PAYLOAD

    return SpanMessageWithMetadata(
        segment_id=segment_id,
        project_id=project_id,
        timestamp=timestamp,
        partition=partition,
        span=payload_value,
    )


def process_message(message: Message[KafkaPayload]) -> SpanMessageWithMetadata | FilteredPayload:
    try:
        return _process_message(message)
    except Exception:
        sentry_sdk.capture_exception()
        return FILTERED_PAYLOAD


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
    ):
        super().__init__()

        # config
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.max_flush_segments = max_flush_segments
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.__pool = MultiprocessingPool(num_processes)

        cluster_name = get_topic_definition(Topic.BUFFERED_SEGMENTS)["cluster"]

        producer_config = get_kafka_producer_cluster_options(cluster_name)
        self.producer = KafkaProducer(build_kafka_configuration(default_config=producer_config))
        self.output_topic = ArroyoTopic(
            get_topic_definition(Topic.BUFFERED_SEGMENTS)["real_topic_name"]
        )

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        committer = CommitOffsets(commit)

        buffer = RedisSpansBuffer(assigned_shards=[p.index for p in partitions])

        flusher = SpanFlusher(
            buffer,
            self.producer,
            self.output_topic,
            self.max_flush_segments,
            next_step=committer,
        )

        run_task = run_task_with_multiprocessing(
            function=partial(process_batch, buffer),
            next_step=flusher,
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.__pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

        batch = BatchStep(
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            next_step=run_task,
        )

        def add_timestamp_cb(message: Message[KafkaPayload]) -> tuple[int, KafkaPayload]:
            return (
                int(message.timestamp.timestamp() if message.timestamp else time.time()),
                message.payload,
            )

        add_timestamp = RunTask(
            function=add_timestamp_cb,
            next_step=batch,
        )

        return add_timestamp

    def shutdown(self) -> None:
        self.producer.close()
        self.__pool.close()


def process_batch(
    buffer: RedisSpansBuffer, values: Message[ValuesBatch[tuple[int, KafkaPayload]]]
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
