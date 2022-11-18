from __future__ import annotations

import logging
import signal
from typing import Any, MutableMapping

from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import IMMEDIATE, CommitPolicy
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies.abstract import ProcessingStrategyFactory
from arroyo.types import Topic, TPayload
from django.conf import settings

from sentry.utils import kafka_config

logger = logging.getLogger("sentry.replays")


def make_replays_stream_processor(
    topic: str,
    group_id: str,
    auto_offset_reset: str,
    force_topic: str | None,
    force_cluster: str | None,
    processor_factory=ProcessingStrategyFactory[TPayload],
    commit_policy: CommitPolicy = IMMEDIATE,
    **options: dict[str, Any],
) -> StreamProcessor[KafkaPayload]:
    """Return a StreamProcessor instance."""
    if options:
        # No additional options are supported currently.  You can make a request to the Replays
        # team or modify this function to support the options you need.
        logger.warning(f"Warning unused options were specified: {', '.join(options.keys())}.")

    topic = force_topic or topic

    # Initialize our wrapper around confluent.KafkaConsumer.
    consumer = KafkaConsumer(
        get_replays_consumer_config(
            topic=topic,
            group_id=group_id,
            auto_offset_reset=auto_offset_reset,
            force_cluster=force_cluster,
        )
    )

    # StreamProcessor continuously polls the producer.
    processor = StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=processor_factory(),
        commit_policy=commit_policy,
    )

    # Shutdown handler for ^C in terminal.
    def handler(signum: int, frame: Any) -> None:
        processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    # Processor does not execute until the `.run()` method is called.
    return processor


def get_replays_consumer_config(
    topic: str, group_id: str, auto_offset_reset: str, force_cluster: str | None
) -> MutableMapping[Any, Any]:
    cluster_name: str = force_cluster or settings.KAFKA_TOPICS[topic]["cluster"]
    consumer_config: MutableMapping[Any, Any] = kafka_config.get_kafka_consumer_cluster_options(
        cluster_name,
        override_params={
            "auto.offset.reset": auto_offset_reset,
            "enable.auto.commit": False,
            "enable.auto.offset.store": False,
            "group.id": group_id,
        },
    )
    return consumer_config
