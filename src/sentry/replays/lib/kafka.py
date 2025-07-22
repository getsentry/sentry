from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.types import Topic as ArroyoTopic

from sentry.conf.types.kafka_definition import Topic
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition
from sentry.utils.pubsub import KafkaPublisher


def _get_ingest_replay_events_producer() -> KafkaProducer:
    config = get_topic_definition(Topic.INGEST_REPLAY_EVENTS)
    producer_config = get_kafka_producer_cluster_options(config["cluster"])
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


ingest_replay_events_producer = SingletonProducer(_get_ingest_replay_events_producer)


def publish_replay_event(message: str) -> None:
    """Publishes messages to the ingest-replay-events topic."""
    ingest_replay_events_producer.produce(
        ArroyoTopic(get_topic_definition(Topic.INGEST_REPLAY_EVENTS)["real_topic_name"]),
        payload=KafkaPayload(None, message.encode("utf-8"), []),
    )


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
