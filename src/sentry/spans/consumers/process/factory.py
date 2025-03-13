import dataclasses
import logging
import threading
import time
from collections.abc import Mapping
from concurrent import futures
from functools import partial
from typing import Any

import orjson
import rapidjson
import sentry_sdk
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from arroyo.backends.kafka.consumer import Headers, KafkaPayload
from arroyo.processing.strategies.abstract import (
    MessageRejected,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.processing.strategies.batching import BatchStep, ValuesBatch
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import FILTERED_PAYLOAD, BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.spans.buffer_v2 import RedisSpansBufferV2, Span, segment_to_span_id
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
        max_inflight_segments: int,
        input_block_size: int | None,
        output_block_size: int | None,
    ):
        super().__init__()

        # config
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.max_flush_segments = max_flush_segments
        self.max_inflight_segments = max_inflight_segments
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

        buffer = RedisSpansBufferV2(assigned_shards=[p.index for p in partitions])

        flusher = SpanFlusher(
            buffer,
            self.producer,
            self.output_topic,
            self.max_flush_segments,
            self.max_inflight_segments,
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
    buffer: RedisSpansBufferV2, values: Message[ValuesBatch[tuple[int, KafkaPayload]]]
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


class SpanFlusher(ProcessingStrategy[int]):
    def __init__(
        self,
        buffer: RedisSpansBufferV2,
        producer: KafkaProducer,
        topic: ArroyoTopic,
        max_flush_segments: int,
        max_inflight_segments: int,
        next_step: ProcessingStrategy[int],
    ):
        self.buffer = buffer
        self.producer = producer
        self.topic = topic
        self.max_flush_segments = max_flush_segments
        self.max_inflight_segments = max_inflight_segments
        self.next_step = next_step

        self.stopped = False
        self.enable_backpressure = False
        self.current_drift = 0

        self.thread = threading.Thread(target=self.main, daemon=True)
        self.thread.start()

        # start_check_hang()

    def main(self):
        while not self.stopped:
            now = int(time.time()) + self.current_drift

            producer_futures = []

            queue_size, flushed_segments = self.buffer.flush_segments(
                max_segments=self.max_flush_segments, now=now
            )
            self.enable_backpressure = (
                self.max_inflight_segments > 0 and queue_size >= self.max_inflight_segments
            )

            if not flushed_segments:
                time.sleep(1)
                continue

            for segment_id, spans_set in flushed_segments.items():
                # TODO: Check if this is correctly placed
                segment_span_id = segment_to_span_id(segment_id)
                if not spans_set:
                    # This is a bug, most likely the input topic is not
                    # partitioned by trace_id so multiple consumers are writing
                    # over each other. The consequence is duplicated segments,
                    # worst-case.
                    metrics.incr("sentry.spans.buffer.empty_segments")
                    continue

                segment_spans = []
                for payload in spans_set:
                    val = rapidjson.loads(payload)
                    val["segment_id"] = segment_span_id
                    val["is_segment"] = segment_span_id == val["span_id"]
                    segment_spans.append(val)

                kafka_payload = KafkaPayload(
                    None, rapidjson.dumps({"spans": segment_spans}).encode("utf8"), []
                )

                producer_futures.append(self.producer.produce(self.topic, kafka_payload))

            futures.wait(producer_futures)

            self.buffer.done_flush_segments(flushed_segments)

    def poll(self) -> None:
        self.next_step.poll()

    def submit(self, message: Message[int]) -> None:
        self.current_drift = message.payload - int(time.time())

        if self.enable_backpressure:
            raise MessageRejected()

        self.next_step.submit(message)

    def terminate(self) -> None:
        self.stopped = True
        self.next_step.terminate()

    def close(self) -> None:
        self.stopped = True
        self.next_step.close()

    def join(self, timeout: float | None = None):
        # set stopped flag first so we can "flush" the background thread while
        # next_step is also shutting down. we can do two things at once!
        self.stopped = True
        deadline = time.time() + timeout if timeout else None

        self.next_step.join(timeout)

        while self.thread.is_alive() and (deadline is None or deadline > time.time()):
            time.sleep(0.1)


def start_check_hang():
    main_thread = threading.get_ident()

    def main():
        import sys
        import traceback

        while True:
            traceback.print_stack(sys._current_frames()[main_thread])
            time.sleep(10)

    hang_thread = threading.Thread(target=main, daemon=True)
    hang_thread.start()
