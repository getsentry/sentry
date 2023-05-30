from typing import Optional

from django.conf import settings

from sentry.utils import kafka_config
from sentry.utils.pubsub import KafkaPublisher

replay_event_producer: Optional[KafkaPublisher] = None


def initialize_replay_event_publisher() -> KafkaPublisher:
    global replay_event_producer

    if replay_event_producer is None:
        config = settings.KAFKA_TOPICS[settings.KAFKA_INGEST_REPLAY_EVENTS]
        replay_event_producer = KafkaPublisher(
            kafka_config.get_kafka_producer_cluster_options(config["cluster"]),
            asynchronous=False,
        )

    return replay_event_producer
