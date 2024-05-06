import dataclasses
import logging
from collections import defaultdict
from collections.abc import Mapping
from typing import Any

import orjson
import rapidjson
import sentry_sdk
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from arroyo.backends.kafka.consumer import Headers, KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.batching import BatchStep, ValuesBatch
from arroyo.processing.strategies.produce import Produce
from arroyo.processing.strategies.run_task import RunTask
from arroyo.processing.strategies.unfold import Unfold
from arroyo.types import FILTERED_PAYLOAD, BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.spans.buffer.redis import ProcessSegmentsContext, RedisSpansBuffer, SegmentKey
from sentry.spans.consumers.process.strategy import CommitSpanOffsets, NoOp
from sentry.utils import metrics
from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)

SPANS_CODEC: Codec[SpanEvent] = get_codec("snuba-spans")
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


def _batch_write_to_redis(message: Message[ValuesBatch[SpanMessageWithMetadata]]):
    """
    Gets a batch of `SpanMessageWithMetadata` and creates a dictionary with
    segment_id as key and a list of spans belonging to that segment_id as value.
    Pushes the batch of spans to redis.
    """
    with sentry_sdk.start_transaction(op="process", name="spans.process.expand_segments"):
        batch = message.payload
        latest_ts_by_partition: dict[int, int] = {}
        spans_map: dict[SegmentKey, list[bytes]] = defaultdict(list)
        segment_first_seen_ts: dict[SegmentKey, int] = {}

        for item in batch:
            payload = item.payload
            partition = payload.partition
            segment_id = payload.segment_id
            project_id = payload.project_id
            span = payload.span
            timestamp = payload.timestamp

            key = SegmentKey(segment_id, project_id, partition)

            # Collects spans for each segment_id
            spans_map[key].append(span)

            # Collects "first_seen" timestamps for each segment in batch.
            # Batch step doesn't guarantee order, so pick lowest ts.
            if key not in segment_first_seen_ts or timestamp < segment_first_seen_ts[key]:
                segment_first_seen_ts[key] = timestamp

            # Collects latest timestamps processed in each partition. It is
            # important to keep track of this per partition because message
            # timestamps are guaranteed to be monotonic per partition only.
            if (
                partition not in latest_ts_by_partition
                or timestamp > latest_ts_by_partition[partition]
            ):
                latest_ts_by_partition[partition] = timestamp

        client = RedisSpansBuffer()

        return client.batch_write_and_check_processing(
            spans_map=spans_map,
            segment_first_seen_ts=segment_first_seen_ts,
            latest_ts_by_partition=latest_ts_by_partition,
        )


def batch_write_to_redis(
    message: Message[ValuesBatch[SpanMessageWithMetadata]],
):
    try:
        return _batch_write_to_redis(message)
    except Exception:
        sentry_sdk.capture_exception()
        return FILTERED_PAYLOAD


def _expand_segments(should_process_segments: list[ProcessSegmentsContext]):
    with sentry_sdk.start_transaction(op="process", name="spans.process.expand_segments") as txn:
        buffered_segments: list[KafkaPayload | FilteredPayload] = []

        for result in should_process_segments:
            timestamp = result.timestamp
            partition = result.partition
            should_process = result.should_process_segments

            if not should_process:
                continue

            client = RedisSpansBuffer()
            payload_context = {}

            with txn.start_child(op="process", description="fetch_unprocessed_segments"):
                keys = client.get_unprocessed_segments_and_prune_bucket(timestamp, partition)

            sentry_sdk.set_measurement("segments.count", len(keys))
            if len(keys) > 0:
                payload_context["sample_key"] = keys[0]

            # With pipelining, redis server is forced to queue replies using
            # up memory, so batching the keys we fetch.
            with txn.start_child(op="process", description="read_and_expire_many_segments"):
                for i in range(0, len(keys), BATCH_SIZE):
                    segments = client.read_and_expire_many_segments(keys[i : i + BATCH_SIZE])

                    for j, segment in enumerate(segments):
                        if not segment:
                            continue

                        payload_data = prepare_buffered_segment_payload(segment)
                        if len(payload_data) > MAX_PAYLOAD_SIZE:
                            logger.warning(
                                "Failed to produce message: max payload size exceeded.",
                                extra={"segment_key": keys[i + j]},
                            )
                            metrics.incr("performance.buffered_segments.max_payload_size_exceeded")
                            continue

                        buffered_segments.append(KafkaPayload(None, payload_data, []))

    return buffered_segments


def expand_segments(should_process_segments: list[ProcessSegmentsContext]):
    try:
        return _expand_segments(should_process_segments)
    except Exception:
        sentry_sdk.capture_exception()
        return []


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
    ):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
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

        produce_step = Produce(
            producer=self.producer,
            topic=self.output_topic,
            next_step=NoOp(),
        )

        unfold_step = Unfold(generator=expand_segments, next_step=produce_step)

        commit_step = CommitSpanOffsets(commit=commit, next_step=unfold_step)

        batch_processor = RunTask(
            function=batch_write_to_redis,
            next_step=commit_step,
        )

        batch_step = BatchStep(
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            next_step=batch_processor,
        )

        return RunTaskWithMultiprocessing(
            function=process_message,
            next_step=batch_step,
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.__pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def shutdown(self) -> None:
        self.producer.close()
        self.__pool.close()
