from __future__ import annotations

import signal
from typing import Any, MutableMapping

from arroyo import Topic
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import IMMEDIATE
from arroyo.processing.processor import StreamProcessor
from django.conf import settings

from sentry.replays.consumers.recording.factory import ProcessReplayRecordingStrategyFactory
from sentry.utils import kafka_config


def get_replays_recordings_consumer(
    topic: str,
    group_id: str,
    max_batch_size: int,
    auto_offset_reset: str,
    force_topic: str | None,
    force_cluster: str | None,
    **options: dict[str, str],
) -> StreamProcessor[KafkaPayload]:
    topic = force_topic or topic
    consumer_config = get_config(topic, group_id, auto_offset_reset, force_cluster)
    consumer = KafkaConsumer(consumer_config)
    processor = StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=ProcessReplayRecordingStrategyFactory(),
        commit_policy=IMMEDIATE,
    )

    def handler(signum: int, frame: Any) -> None:
        processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    return processor


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
