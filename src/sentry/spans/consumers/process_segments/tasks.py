from __future__ import annotations

import logging

import orjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from django.conf import settings
from redis.client import StrictRedis
from redis.exceptions import TimeoutError as RedisTimeoutError
from sentry_redis_tools.clients import RedisCluster
from taskbroker_client.constants import CompressionType
from taskbroker_client.retry import Retry
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.spans.consumers.process_segments.convert import convert_span_to_item
from sentry.spans.consumers.process_segments.message import process_segment
from sentry.spans.consumers.process_segments.types import CompatibleSpan
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import spans_process_segments_tasks
from sentry.utils import metrics, redis
from sentry.utils.arroyo_producer import get_arroyo_producer, get_future_tracking_producer
from sentry.utils.kafka_config import get_topic_definition

logger = logging.getLogger(__name__)


def _get_snuba_items_producer() -> KafkaProducer:
    return get_arroyo_producer(
        "sentry.spans.process_segments.snuba_items",
        Topic.SNUBA_ITEMS,
    )


_snuba_items_producer = get_future_tracking_producer(
    producer_name="sentry.spans.process_segments.snuba_items",
    producer_factory=_get_snuba_items_producer,
)
_snuba_items_topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])


def get_dedupe_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    cluster = settings.SENTRY_SPAN_DEDUPE_CLUSTER or settings.SENTRY_SPAN_BUFFER_CLUSTER
    return redis.redis_clusters.get_binary(cluster)


def _check_span_duplicates(spans: list[CompatibleSpan]) -> list[CompatibleSpan]:
    """
    Check for and optionally filter duplicate spans using Redis SETNX.

    Uses atomic set-if-not-exists to both check and mark spans as seen in one operation.
    This provides at-most-once delivery: if the task crashes after SETNX but before
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


def _process_segment_bytes(segment_bytes: bytes) -> list[KafkaPayload]:
    segment = orjson.loads(segment_bytes)
    skip_enrichment = segment.get("skip_enrichment", False)
    processed = process_segment(
        segment["spans"],
        skip_enrichment=skip_enrichment,
    )
    processed = _check_span_duplicates(processed)
    return [_serialize_payload(span) for span in processed]


@instrumented_task(
    name="sentry.spans.process_segments.process_segment",
    namespace=spans_process_segments_tasks,
    processing_deadline_duration=65,
    retry=Retry(times=3, delay=5, on=(ProcessingDeadlineExceeded, RedisTimeoutError)),
    compression_type=CompressionType.ZSTD,
    silo_mode=SiloMode.CELL,
)
def process_segment_task(segment_bytes: bytes) -> None:
    for payload in _process_segment_bytes(segment_bytes):
        _snuba_items_producer.produce(_snuba_items_topic, payload)
