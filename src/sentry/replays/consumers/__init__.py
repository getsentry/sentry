from __future__ import annotations

from typing import Any, MutableMapping

from arroyo import Topic, configure_metrics
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from django.conf import settings

from sentry.replays.consumers.recording import ProcessReplayRecordingStrategyFactory
from sentry.utils import kafka_config, metrics
from sentry.utils.arroyo import MetricsWrapper


def get_replays_recordings_consumer(
    topic: str,
    group_id: str,
    auto_offset_reset: str,
    force_topic: str | None,
    force_cluster: str | None,
) -> StreamProcessor[KafkaPayload]:
    topic = force_topic or topic
    configure_metrics(MetricsWrapper(metrics.backend, name="ingest_replays"))
    consumer_config = get_config(topic, group_id, auto_offset_reset, force_cluster)
    consumer = KafkaConsumer(consumer_config)
    return StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=ProcessReplayRecordingStrategyFactory(),
        commit_policy=ONCE_PER_SECOND,
    )


def get_config(
    topic: str, group_id: str, auto_offset_reset: str, force_cluster: str | None
) -> MutableMapping[str, Any]:
    cluster_name: str = force_cluster or settings.KAFKA_TOPICS[topic]["cluster"]
    return build_kafka_consumer_configuration(
        kafka_config.get_kafka_consumer_cluster_options(
            cluster_name,
        ),
        group_id=group_id,
        auto_offset_reset=auto_offset_reset,
    )
