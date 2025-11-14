from __future__ import annotations

from typing import int, Any

from arroyo.backends.kafka import ConfluentProducer
from confluent_kafka import Producer


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
    return ConfluentProducer(configuration)
