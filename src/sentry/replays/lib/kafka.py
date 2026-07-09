from arroyo.backends.kafka import FutureTrackingProducer, KafkaPayload
from arroyo.types import Topic as ArroyoTopic
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.utils.arroyo_producer import get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition

#
# EAP PRODUCER
#


EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)

# The raw-mode taskbroker task that processes ingest-replay-recordings. tasks.py
# references this constant as the task's name so the two can't drift.
PROCESS_REPLAY_RECORDING_TASK_NAME = "sentry.replays.tasks.process_replay_recording"


def _get_eap_items_producer():
    """Get a Kafka producer for EAP TraceItems."""
    return get_arroyo_producer(
        name="sentry.replays.lib.kafka.eap_items",
        topic=Topic.SNUBA_ITEMS,
    )


eap_producer = FutureTrackingProducer(
    name="sentry.replays.lib.kafka.eap_items",
    producer_factory=_get_eap_items_producer,
)


def write_trace_items(trace_items: list[TraceItem]) -> None:
    """Publish trace-items to the EAP trace-items topic."""
    topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
    for trace_item in trace_items:
        payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
        eap_producer.produce(topic, payload)


#
# REPLAY PRODUCER
#


def _get_ingest_replay_events_producer():
    return get_arroyo_producer(
        name="sentry.replays.lib.kafka.ingest_replay_events",
        topic=Topic.INGEST_REPLAY_EVENTS,
    )


ingest_replay_events_producer = FutureTrackingProducer(
    name="sentry.replays.lib.kafka.ingest_replay_events",
    producer_factory=_get_ingest_replay_events_producer,
)


def publish_replay_event(message: str) -> None:
    """Publishes messages to the ingest-replay-events topic."""
    ingest_replay_events_producer.produce(
        ArroyoTopic(get_topic_definition(Topic.INGEST_REPLAY_EVENTS)["real_topic_name"]),
        payload=KafkaPayload(None, message.encode("utf-8"), []),
    )
