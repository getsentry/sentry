from __future__ import annotations

import logging
from enum import Enum

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from confluent_kafka import KafkaException
from django.conf import settings

from sentry.conf.types.kafka_definition import Topic
from sentry.utils import json
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition

logger = logging.getLogger(__name__)


class PreprodFeature(Enum):
    SIZE_ANALYSIS = "size_analysis"
    BUILD_DISTRIBUTION = "build_distribution"


def _get_preprod_producer() -> KafkaProducer:
    return get_arroyo_producer(
        "sentry.preprod.producer",
        Topic.PREPROD_ARTIFACT_EVENTS,
        exclude_config_keys=["compression.type", "message.max.bytes"],
    )


_preprod_producer = SingletonProducer(
    _get_preprod_producer, max_futures=settings.SENTRY_PREPROD_ARTIFACT_EVENTS_FUTURES_MAX_LIMIT
)


def produce_preprod_artifact_to_kafka(
    project_id: int,
    organization_id: int,
    artifact_id: int,
    requested_features: list[PreprodFeature] | None = None,
) -> None:
    if requested_features is None:
        requested_features = []
    payload_data = {
        "artifact_id": str(artifact_id),
        "project_id": str(project_id),
        "organization_id": str(organization_id),
        "requested_features": [feature.value for feature in requested_features],
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
