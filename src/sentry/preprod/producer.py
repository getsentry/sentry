from __future__ import annotations

import logging
from enum import Enum

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_producer_configuration
from confluent_kafka import KafkaException, Producer
from django.conf import settings

from sentry import features
from sentry.conf.types.kafka_definition import Topic
from sentry.models.organization import Organization
from sentry.utils import json
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.confluent_producer import get_confluent_producer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

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

_preprod_confluent_producer: Producer | None = None


def _get_or_create_confluent_producer() -> Producer:
    """Get or create the Confluent Kafka producer for preprod events."""
    global _preprod_confluent_producer
    if _preprod_confluent_producer is None:
        cluster_name = get_topic_definition(Topic.PREPROD_ARTIFACT_EVENTS)["cluster"]
        cluster_options = get_kafka_producer_cluster_options(cluster_name)
        cluster_options["client.id"] = "sentry.preprod.kafka"
        _preprod_confluent_producer = get_confluent_producer(
            build_kafka_producer_configuration(default_config=cluster_options)
        )
    return _preprod_confluent_producer


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

    # Determine which producer to use based on feature flag
    use_confluent = False
    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
        use_confluent = features.has("organizations:preprod-use-confluent-producer", organization)
    except Organization.DoesNotExist:
        logger.warning(
            "Organization not found for preprod artifact, using default producer",
            extra={"artifact_id": artifact_id, "organization_id": organization_id},
        )

    try:
        topic = get_topic_definition(Topic.PREPROD_ARTIFACT_EVENTS)["real_topic_name"]

        if use_confluent:
            producer = _get_or_create_confluent_producer()
            producer.produce(
                topic=topic,
                key=payload.key,
                value=payload.value,
                headers=payload.headers or None,
            )
            producer.poll(0)
        else:
            _preprod_producer.produce(ArroyoTopic(topic), payload)
    except KafkaException:
        logger.exception(
            "Failed to send preprod artifact message to Kafka",
            extra={"artifact_id": artifact_id, "project_id": project_id},
        )
        raise  # Re-raise to trigger task retry
