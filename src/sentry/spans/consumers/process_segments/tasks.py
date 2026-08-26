from __future__ import annotations

import orjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from redis.exceptions import TimeoutError as RedisTimeoutError
from taskbroker_client.constants import CompressionType
from taskbroker_client.retry import Retry
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.spans.consumers.process_segments.convert import convert_span_to_item
from sentry.spans.consumers.process_segments.message import process_segment
from sentry.spans.consumers.process_segments.types import CompatibleSpan
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import spans_process_segments_tasks
from sentry.utils.arroyo_producer import get_arroyo_producer, get_future_tracking_producer
from sentry.utils.kafka_config import get_topic_definition


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
