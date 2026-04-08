import logging
from collections.abc import Callable

from sentry.scm.errors import SCMProviderEventNotSupported, SCMProviderNotSupported
from sentry.scm.private.ipc import (
    PRODUCE_TO_LISTENER,
    produce_to_listener,
    produce_to_listeners,
    record_count_metric,
    report_error_to_sentry,
)
from sentry.scm.types import HybridCloudSilo, SubscriptionEvent
from sentry.scm.utils import check_rollout_option

logger = logging.getLogger("sentry.scm")
PREFIX = "sentry.scm.produce_event_to_scm_stream"


def produce_event_to_scm_stream(
    event: SubscriptionEvent,
    silo: HybridCloudSilo,
    *,
    is_dev: bool = False,
    produce_to_listener: PRODUCE_TO_LISTENER = produce_to_listener,
    record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
    report_error: Callable[[Exception], None] = report_error_to_sentry,
    rollout_enabled: Callable[[str], bool] = check_rollout_option,
) -> None:
    """
    Publish source code management service provider subscription events.

    Messages published to the topic have had their provenance asserted. They are genuine requests
    and can be trusted. Untrusted messages are only published to the stream under one condition:
    they are github_enterprise webhooks with their skipped_validation explicitly marked. There is
    no guarantee or requirement for down-stream consumers to validate their message's authenticity.
    """
    if not rollout_enabled("sentry.scm.stream.rollout"):
        return None

    try:
        produce_to_listeners(event, silo, produce_to_listener=produce_to_listener)
        record_count(f"{PREFIX}.success", 1, {})
        if is_dev:
            logger.info(f"Successfully processed SCM webhook event: {event['event_type_hint']}.")
    except SCMProviderNotSupported:
        record_count(
            f"{PREFIX}.failed", 1, {"reason": "provider-not-supported", "provider": event["type"]}
        )
        if is_dev:
            logger.exception("Failed to process SCM webhook event.")
    except SCMProviderEventNotSupported:
        record_count(
            f"{PREFIX}.failed", 1, {"reason": "event-not-supported", "provider": event["type"]}
        )
        if is_dev:
            logger.exception("Failed to process SCM webhook event.")
    except Exception as e:
        record_count(f"{PREFIX}.failed", 1, {"reason": "processing"})
        report_error(e)
        if is_dev:
            logger.exception("Failed to process SCM webhook event.")


__all__ = [
    "SubscriptionEvent",
    "produce_event_to_scm_stream",
]
