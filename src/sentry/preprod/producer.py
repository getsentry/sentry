from __future__ import annotations

import logging
from typing import Any

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from confluent_kafka import KafkaException
from django.conf import settings

from sentry.conf.types.kafka_definition import Topic
from sentry.utils import json
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


def _get_preprod_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.PREPROD_ARTIFACT_EVENTS)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_preprod_producer = SingletonProducer(
    _get_preprod_producer, max_futures=settings.SENTRY_PREPROD_ARTIFACT_EVENTS_FUTURES_MAX_LIMIT
)


def produce_preprod_artifact_to_kafka(
    project_id: int,
    organization_id: int,
    artifact_id: int,
    **kwargs: Any,
) -> None:
    payload_data = {
        "artifact_id": str(artifact_id),
        "project_id": str(project_id),
        "organization_id": str(organization_id),
        **kwargs,
    }

    partition_key = f"{project_id}-{artifact_id}".encode()
    payload = KafkaPayload(partition_key, json.dumps(payload_data).encode("utf-8"), [])

    try:
        topic = get_topic_definition(Topic.PREPROD_ARTIFACT_EVENTS)["real_topic_name"]
        _preprod_producer.produce(ArroyoTopic(topic), payload)
    except KafkaException:
        logger.exception(
            "Failed to send preprod artifact message to Kafka",
            extra={"artifact_id": artifact_id, "project_id": project_id},
        )
        raise  # Re-raise to trigger task retry
