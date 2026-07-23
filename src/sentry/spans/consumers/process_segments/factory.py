from __future__ import annotations

import logging
from collections.abc import Mapping
from functools import partial

import orjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.produce import Produce
from arroyo.processing.strategies.unfold import Unfold
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition, Value
from django.conf import settings
from redis.client import StrictRedis
from sentry_redis_tools.clients import RedisCluster

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.spans.consumers.process_segments.convert import convert_span_to_item
from sentry.spans.consumers.process_segments.message import process_segment
from sentry.spans.consumers.process_segments.types import CompatibleSpan
from sentry.utils import metrics, redis
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing
from sentry.utils.arroyo_producer import get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition

logger = logging.getLogger(__name__)


def get_dedupe_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    cluster = settings.SENTRY_SPAN_DEDUPE_CLUSTER or settings.SENTRY_SPAN_BUFFER_CLUSTER
    return redis.redis_clusters.get_binary(cluster)


def _check_span_duplicates(spans: list[CompatibleSpan]) -> list[CompatibleSpan]:
    """
    Check for and optionally filter duplicate spans using Redis SETNX.

    Uses atomic set-if-not-exists to both check and mark spans as seen in one operation.
    This provides at-most-once delivery: if the consumer crashes after SETNX but before
    producing to Kafka, the span is lost. This is preferred over the alternative (marking
    after produce) which allows duplicates through race conditions.

    When dedupe-filter-enable is True: filters out duplicates and returns only new spans.
    When dedupe-filter-enable is False: emits metrics only, returns all spans.
    """
    if not spans:
        return spans

    dedupe_ttl = options.get("spans.process-segments.dedupe-ttl")
    if dedupe_ttl <= 0:
        return spans

    filter_duplicates = options.get("spans.process-segments.dedupe-filter-enable")

    try:
        client = get_dedupe_redis_client()
        with client.pipeline(transaction=False) as p:
            for span in spans:
                dedupe_key = f"segments-consumer:dedupe:{span['project_id']}:{span['trace_id']}:{span['span_id']}"
                p.set(dedupe_key, b"1", ex=dedupe_ttl, nx=True)
            results = p.execute()

        filtered = [span for span, is_new in zip(spans, results) if is_new]
        duplicates = len(spans) - len(filtered)
        if duplicates:
            metrics.incr("spans.process-segments.duplicate_span", amount=duplicates)

        return filtered if filter_duplicates else spans
    except Exception:
        logger.exception("Failed to check span duplicates")
        return spans


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

        # Due to the unfold step that precedes the producer, this pipeline
        # writes large bursts of spans at once when a batch of segments is
        # finished by the multi processing pool. We size the produce buffer
        # so that it can accommodate batches from all subprocesses at the
        # sime time, assuming some upper bound of spans per segment.
        self.kafka_queue_size = self.max_batch_size * self.num_processes * SPANS_PER_SEG_P95

        self.producer = get_arroyo_producer(
            "sentry.spans.consumers.process_segments",
            Topic.SNUBA_ITEMS,
            additional_config={"queue.buffering.max.messages": self.kafka_queue_size},
            use_simple_futures=True,
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
            function=partial(_process_message, skip_produce=self.skip_produce),
            next_step=unfold_step,
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def shutdown(self) -> None:
        self.pool.close()


def _process_segment_bytes(
    segment_bytes: bytes, skip_produce: bool = False, start_new_transaction: bool = True
) -> list[KafkaPayload]:
    segment = orjson.loads(segment_bytes)
    skip_enrichment = segment.get("skip_enrichment", False)
    processed = process_segment(
        segment["spans"],
        skip_produce=skip_produce,
        skip_enrichment=skip_enrichment,
        start_new_transaction=start_new_transaction,
    )
    processed = _check_span_duplicates(processed)
    return [_serialize_payload(span) for span in processed]


def _process_message(
    message: Message[KafkaPayload], skip_produce: bool = False
) -> list[Value[KafkaPayload]]:
    assert isinstance(message.value, BrokerValue)

    try:
        value = message.payload.value
        return [
            Value(payload, {}, message.timestamp)
            for payload in _process_segment_bytes(value, skip_produce=skip_produce)
        ]
    except Exception:
        logger.exception("segments.invalid-message")
        raise InvalidMessage(message.value.partition, message.value.offset)


def _serialize_payload(span: CompatibleSpan) -> KafkaPayload:
    item = convert_span_to_item(span)

    return KafkaPayload(
        None,
        item.SerializeToString(),
        [
            ("item_type", str(item.item_type).encode("ascii")),
            ("project_id", str(span["project_id"]).encode("ascii")),
        ],
    )


def _unfold_segment(spans: list[Value[KafkaPayload]]) -> list[Value[KafkaPayload]]:
    return [span for span in spans if span is not None]
