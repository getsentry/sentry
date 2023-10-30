import logging
import time
from typing import List

from confluent_kafka import KafkaError
from confluent_kafka.admin import AdminClient
from django.conf import settings

from sentry.utils import kafka_config

logger = logging.getLogger("sentry.batching-kafka-consumer")

DEFAULT_QUEUED_MAX_MESSAGE_KBYTES = 50000
DEFAULT_QUEUED_MIN_MESSAGES = 10000


def wait_for_topics(admin_client: AdminClient, topics: List[str], timeout: int = 10) -> None:
    """
    Make sure that the provided topics exist and have non-zero partitions in them.
    """
    for topic in topics:
        start = time.time()
        last_error = None

        while True:
            if time.time() > start + timeout:
                raise RuntimeError(
                    f"Timeout when waiting for Kafka topic '{topic}' to become available, last error: {last_error}"
                )

            result = admin_client.list_topics(topic=topic, timeout=timeout)
            topic_metadata = result.topics.get(topic)
            if topic_metadata and topic_metadata.partitions and not topic_metadata.error:
                logger.debug("Topic '%s' is ready", topic)
                break
            elif topic_metadata.error in {
                KafkaError.UNKNOWN_TOPIC_OR_PART,
                KafkaError.LEADER_NOT_AVAILABLE,
            }:
                last_error = topic_metadata.error
                logger.warning("Topic '%s' or its partitions are not ready, retrying...", topic)
                time.sleep(0.1)
                continue
            else:
                raise RuntimeError(
                    "Unknown error when waiting for Kafka topic '%s': %s"
                    % (topic, topic_metadata.error)
                )


def create_topics(cluster_name: str, topics: List[str], force: bool = False) -> None:
    """
    If configured to do so, create topics and make sure that they exist

    topics must be from the same cluster.
    """
    if settings.KAFKA_CONSUMER_AUTO_CREATE_TOPICS or force:
        conf = kafka_config.get_kafka_admin_cluster_options(cluster_name)
        # Topics are implicitly created here
        admin_client = AdminClient(conf)
        wait_for_topics(admin_client, topics)
