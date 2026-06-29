from functools import partial

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Topic as ArroyoTopic
from django.conf import settings
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem
from taskbroker_client.worker.producer import TaskProducer

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.options.rollout import in_random_rollout
from sentry.taskworker.producer import get_task_producer
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition

#
# EAP PRODUCER
#


EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer():
    """Get a Kafka producer for EAP TraceItems."""
    return get_arroyo_producer(
        name="sentry.replays.lib.kafka.eap_items",
        topic=Topic.SNUBA_ITEMS,
    )


eap_producer = SingletonProducer(_get_eap_items_producer)


#
# REPLAY PRODUCER
#


def _get_ingest_replay_events_producer(name: str = "sentry.replays.lib.kafka.ingest_replay_events"):
    return get_arroyo_producer(
        name=name,
        topic=Topic.INGEST_REPLAY_EVENTS,
    )


ingest_replay_events_producer = SingletonProducer(_get_ingest_replay_events_producer)
_task_producer_name = "sentry.replays.lib.kafka.ingest_replay_events_taskproducer"
ingest_replay_events_taskproducer = get_task_producer(
    producer_name=_task_producer_name,
    producer_factory=partial(_get_ingest_replay_events_producer, name=_task_producer_name),
)


def publish_replay_event(message: str) -> None:
    """Publishes messages to the ingest-replay-events topic."""
    if settings.TASKWORKER_USE_TASK_PRODUCER and in_random_rollout(
        "tasks.producer.replays.rollout"
    ):
        producer: SingletonProducer | TaskProducer = ingest_replay_events_taskproducer
    else:
        producer = ingest_replay_events_producer
    producer.produce(
        ArroyoTopic(get_topic_definition(Topic.INGEST_REPLAY_EVENTS)["real_topic_name"]),
        payload=KafkaPayload(None, message.encode("utf-8"), []),
    )
