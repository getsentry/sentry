from __future__ import annotations

import logging

from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from django.conf import settings
from usageaccountant import UsageAccumulator, UsageUnit

from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger("usageaccountant")


accumulator: UsageAccumulator | None = None


def _accumulator(create: bool = False) -> UsageAccumulator | None:
    global accumulator
    if accumulator is None and create:
        producer = KafkaProducer(
            build_kafka_configuration(
                get_kafka_producer_cluster_options(
                    get_topic_definition(settings.KAFKA_SHARED_RESOURCES_USAGE)["cluster"]
                )
            )
        )
        accumulator = UsageAccumulator(producer=producer)
    return accumulator


def record_cogs(resource_id: str, app_feature: str, amount: int, usage_type: UsageUnit) -> None:
    """
    Spins up an instance (if it does not exist) of UsageAccumulator and records
    cogs data to the configured shared resources usage topic.

    *GOTCHAS*
    - You must call `close_cogs_recorder` in order to flush and close the producer
    used by the UsageAccumulator
    - Eg. if this is used in a consumer, call the close function in the consumers
    close out path
    """
    try:
        accumulator = _accumulator(create=True)
        assert accumulator is not None
        accumulator.record(resource_id, app_feature, amount, usage_type)
    except Exception as err:
        logger.warning("Could not record COGS due to error: %r", err, exc_info=True)


def close_cogs_recorder() -> None:
    """
    Flushes and closes any Producer used by UsageAccumulator.

    This producer only gets created if the `record_cogs` function is called at least
    once.
    """
    logger.info("Flushing and closing cogs recorder if it exists...")
    try:
        accumulator = _accumulator()
        if accumulator is not None:
            accumulator.flush()
            accumulator.close()
    except Exception as err:
        logger.error("Error shutting down COGS producer: %r", err, exc_info=True)
