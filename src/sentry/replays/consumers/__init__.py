from __future__ import annotations

from typing import Any, MutableMapping

from arroyo import Topic
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from django.conf import settings

from sentry.replays.consumers.recording import ProcessReplayRecordingStrategyFactory
from sentry.utils import kafka_config


def get_replays_recordings_consumer(
    topic: str,
    group_id: str,
    auto_offset_reset: str,
    input_block_size: int,
    max_batch_size: int,
    max_batch_time: int,
    num_processes: int,
    output_block_size: int,
    use_multi_proc: bool,
    force_topic: str | None,
    force_cluster: str | None,
) -> StreamProcessor[KafkaPayload]:
    topic = force_topic or topic

    consumer_config = get_config(topic, group_id, auto_offset_reset, force_cluster)
    consumer = KafkaConsumer(consumer_config)

    return StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=ProcessReplayRecordingStrategyFactory(
            input_block_size=input_block_size,
            max_batch_size=max_batch_size,
            max_batch_time=max_batch_time,
            num_processes=num_processes,
            output_block_size=output_block_size,
            use_multi_proc=use_multi_proc,
        ),
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
