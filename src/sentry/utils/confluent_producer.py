from __future__ import annotations

from typing import Any

from arroyo.backends.kafka import ConfluentProducer
from confluent_kafka import Producer

from sentry import options


def get_confluent_producer(
    configuration: dict[str, Any],
) -> Producer:
    """
    Get a confluent_kafka Producer for a given configuration.

    Args:
        configuration: The configuration for the confluent_kafka Producer

    Returns:
        confluent_kafka Producer
    """
    rollout_config = options.get("arroyo.producer.confluent-producer-rollout", {})
    name = configuration.get("client.id")

    # f"sentry.sentry_metrics.slicing_router.{current_sliceable}.{current_slice_id}"
    if name is not None and isinstance(name, str):
        if name.startswith("sentry.sentry_metrics.slicing_router"):
            name = "sentry.sentry_metrics.slicing_router"

    if rollout_config.get(name, False):
        return ConfluentProducer(configuration)
    return Producer(configuration)
