from typing import int
"""
This module is meant to manage the lifecycle of the UsageAccumulator
to record shared resource usage amount.

Since the UsageAccumulator depends on an Arroyo Kafka producer, the
lifecycle is critical as the Threadpool has to be closed upon exit
and the producer needs to be flushed to avoid loosing data.
"""

import atexit
import logging

from usageaccountant import UsageAccumulator, UsageUnit

from sentry.conf.types.kafka_definition import Topic
from sentry.options import get
from sentry.utils.arroyo_producer import get_arroyo_producer

logger = logging.getLogger(__name__)

_accountant_backend: UsageAccumulator | None = None


def _shutdown() -> None:
    if _accountant_backend is not None:
        _accountant_backend.flush()
        _accountant_backend.close()
        logger.info("Usage accountant flushed and closed.")


def record(
    resource_id: str,
    app_feature: str,
    amount: int,
    usage_type: UsageUnit,
) -> None:
    """
    Records usage of a shared feature. It also initializes the UsageAccumulator
    if one is not ready.

    When the application exits the producer is flushed and closed.
    """

    global _accountant_backend
    if resource_id not in get("shared_resources_accounting_enabled"):
        return

    if _accountant_backend is None:
        producer = get_arroyo_producer("sentry.usage_accountant", Topic.SHARED_RESOURCES_USAGE)
        _accountant_backend = UsageAccumulator(producer=producer)
        atexit.register(_shutdown)

    _accountant_backend.record(resource_id, app_feature, amount, usage_type)
