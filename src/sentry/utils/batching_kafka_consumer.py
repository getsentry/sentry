import logging
import time
from collections.abc import Mapping

from confluent_kafka import KafkaError, KafkaException
from confluent_kafka.admin import AdminClient, NewTopic  # type: ignore[attr-defined]
from sentry_kafka_schemas import SchemaNotFound, get_topic

from sentry.utils import kafka_config

logger = logging.getLogger("sentry.batching-kafka-consumer")

TopicCreationConfig = tuple[int, Mapping[str, str]]


def _get_topic_creation_config(topic: str) -> TopicCreationConfig:
    try:
        topic_data = get_topic(topic)
    except SchemaNotFound:
        # Topic names can be overridden to something that has no schema entry.
        return 1, {}

    return topic_data["enforced_partition_count"] or 1, topic_data["topic_creation_config"]


def wait_for_topics(admin_client: AdminClient, topics: list[str], timeout: int = 10) -> None:
    """
    Make sure that the provided topics exist and have non-zero partitions in them.
    """
    for topic in topics:
        start = time.time()
        last_error: str | KafkaError | None = None

        while True:
            if time.time() > start + timeout:
                raise RuntimeError(
                    f"Timeout when waiting for Kafka topic '{topic}' to become available, last error: {last_error}"
                )

            result = admin_client.list_topics(topic=topic, timeout=timeout)
            topic_metadata = result.topics.get(topic)
            if topic_metadata is None:
                last_error = "Topic metadata not found"
                time.sleep(0.1)
                continue
            if topic_metadata.partitions and not topic_metadata.error:
                logger.debug("Topic '%s' is ready", topic)
                break
            elif topic_metadata.error is not None and topic_metadata.error.code() in {
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


def create_topics(
    cluster_name: str,
    topics: list[str],
    *,
    topic_creation_configs: Mapping[str, TopicCreationConfig] | None = None,
) -> None:
    """
    Create topics and make sure that they exist.

    topics must be from the same cluster.
    """
    if not topics:
        return

    conf = kafka_config.get_kafka_admin_cluster_options(cluster_name)
    admin_client = AdminClient(conf)

    new_topics = []
    for topic in topics:
        num_partitions, config = (
            topic_creation_configs[topic]
            if topic_creation_configs and topic in topic_creation_configs
            else _get_topic_creation_config(topic)
        )
        new_topics.append(
            NewTopic(
                topic,
                num_partitions=num_partitions,
                replication_factor=1,
                config=dict(config),
            )
        )

    futures = admin_client.create_topics(new_topics)
    for topic, future in futures.items():
        try:
            future.result()
        except KafkaException as error:
            if error.args[0].code() != KafkaError.TOPIC_ALREADY_EXISTS:
                raise
            logger.debug("Topic '%s' already exists", topic)

    wait_for_topics(admin_client, topics)
