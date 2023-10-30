from typing import Optional

from django.conf import settings

from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition
from sentry.utils.pubsub import KafkaPublisher

replay_publisher: Optional[KafkaPublisher] = None


def initialize_replays_publisher(is_async=False) -> KafkaPublisher:
    global replay_publisher

    if replay_publisher is None:
        config = get_topic_definition(settings.KAFKA_INGEST_REPLAY_EVENTS)
        replay_publisher = KafkaPublisher(
            get_kafka_producer_cluster_options(config["cluster"]),
            asynchronous=is_async,
        )

    return replay_publisher


def clear_replay_publisher() -> None:
    global replay_publisher
    replay_publisher = None
