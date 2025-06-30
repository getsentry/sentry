from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition
from sentry.utils.pubsub import KafkaPublisher

# EAP PRODUCER

EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer() -> KafkaProducer:
    """Get a Kafka producer for EAP TraceItems."""
    cluster_name = get_topic_definition(Topic.SNUBA_ITEMS)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


eap_producer = SingletonProducer(_get_eap_items_producer)

# REPLAY PRODUCERS

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
    return KafkaPublisher(
        get_kafka_producer_cluster_options(config["cluster"]),
        asynchronous=is_async,
    )


def clear_replay_publisher() -> None:
    global sync_publisher
    global async_publisher

    sync_publisher = None
    async_publisher = None
