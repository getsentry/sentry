from __future__ import annotations

from functools import partial

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaProducer
from taskbroker_client.constants import CompressionType

from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.spans.consumers.process_segments.factory import _process_segment_bytes
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import spans_process_segments_tasks
from sentry.taskworker.producer import get_task_producer
from sentry.utils.arroyo_producer import get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition


def _get_snuba_items_producer(
    name: str = "sentry.spans.process_segments.snuba_items",
) -> KafkaProducer:
    return get_arroyo_producer(
        name,
        Topic.SNUBA_ITEMS,
    )


_snuba_items_task_producer_name = "sentry.spans.process_segments.snuba_items_taskproducer"
_snuba_items_task_producer = get_task_producer(
    producer_name=_snuba_items_task_producer_name,
    producer_factory=partial(_get_snuba_items_producer, name=_snuba_items_task_producer_name),
)
_snuba_items_topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])


@instrumented_task(
    name="sentry.spans.process_segments.process_segment",
    namespace=spans_process_segments_tasks,
    at_most_once=True,
    compression_type=CompressionType.ZSTD,
    silo_mode=SiloMode.CELL,
)
def process_segment_task(segment_bytes: bytes) -> None:
    for payload in _process_segment_bytes(segment_bytes):
        _snuba_items_task_producer.produce(_snuba_items_topic, payload)
