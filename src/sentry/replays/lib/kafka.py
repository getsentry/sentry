from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.types import Topic as ArroyoTopic
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition
from sentry.utils.pubsub import KafkaPublisher

#
# EAP PRODUCER
#


EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer():
    """Get a Kafka producer for EAP TraceItems."""
    producer = get_arroyo_producer(
        name="sentry.replays.lib.kafka.eap_items",
        topic=Topic.SNUBA_ITEMS,
    )

    # Fallback to legacy producer creation if not rolled out
    if producer is None:
        cluster_name = get_topic_definition(Topic.SNUBA_ITEMS)["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        producer_config["client.id"] = "sentry.replays.lib.kafka.eap_items"
        producer = KafkaProducer(build_kafka_configuration(default_config=producer_config))

    return producer


eap_producer = SingletonProducer(_get_eap_items_producer)


#
# REPLAY PRODUCER
#


def _get_ingest_replay_events_producer():
    producer = get_arroyo_producer(
        name="sentry.replays.lib.kafka.ingest_replay_events",
        topic=Topic.INGEST_REPLAY_EVENTS,
    )

    # Fallback to legacy producer creation if not rolled out
    if producer is None:
        config = get_topic_definition(Topic.INGEST_REPLAY_EVENTS)
        producer_config = get_kafka_producer_cluster_options(config["cluster"])
        producer_config["client.id"] = "sentry.replays.lib.kafka.ingest_replay_events"
        producer = KafkaProducer(build_kafka_configuration(default_config=producer_config))

    return producer


ingest_replay_events_producer = SingletonProducer(_get_ingest_replay_events_producer)


def publish_replay_event(message: str) -> None:
    """Publishes messages to the ingest-replay-events topic."""
    ingest_replay_events_producer.produce(
        ArroyoTopic(get_topic_definition(Topic.INGEST_REPLAY_EVENTS)["real_topic_name"]),
        payload=KafkaPayload(None, message.encode("utf-8"), []),
    )


#
# LEGACY PRODUCERS
#

# We keep a synchronous and asynchronous singleton because a shared singleton could lead
# to synchronous publishing when asynchronous publishing was desired and vice-versa.
sync_publisher: KafkaPublisher | None = None
async_publisher: KafkaPublisher | None = None


def initialize_replays_publisher(is_async: bool = False) -> KafkaPublisher:
    if is_async:
        global async_publisher

        if async_publisher is None:
            async_publisher = _init_replay_publisher(is_async=True)

        return async_publisher
    else:
        global sync_publisher

        if sync_publisher is None:
            sync_publisher = _init_replay_publisher(is_async=False)

        return sync_publisher


def _init_replay_publisher(is_async: bool) -> KafkaPublisher:
    config = get_topic_definition(Topic.INGEST_REPLAY_EVENTS)
    producer_config = get_kafka_producer_cluster_options(config["cluster"])
    producer_config["client.id"] = (
        "sentry.replays.lib.kafka.publisher.async"
        if is_async
        else "sentry.replays.lib.kafka.publisher.sync"
    )
    return KafkaPublisher(
        producer_config,
        asynchronous=is_async,
    )


def clear_replay_publisher() -> None:
    global sync_publisher
    global async_publisher

    sync_publisher = None
    async_publisher = None
