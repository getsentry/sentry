from __future__ import annotations

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import FutureTrackingProducer, KafkaProducer
from redis.exceptions import TimeoutError as RedisTimeoutError
from taskbroker_client.constants import CompressionType
from taskbroker_client.retry import Retry
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.spans.consumers.process_segments.factory import _process_segment_bytes
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import spans_process_segments_tasks
from sentry.utils.arroyo_producer import get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition


def _get_snuba_items_producer() -> KafkaProducer:
    return get_arroyo_producer(
        "sentry.spans.process_segments.snuba_items",
        Topic.SNUBA_ITEMS,
    )


_snuba_items_producer = FutureTrackingProducer(
    name="sentry.spans.process_segments.snuba_items",
    producer_factory=_get_snuba_items_producer,
)
_snuba_items_topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])


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
