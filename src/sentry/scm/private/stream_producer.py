from collections.abc import Callable

from sentry.scm.errors import SCMProviderNotSupported
from sentry.scm.private.ipc import (
    PRODUCE_TO_LISTENER,
    produce_to_listener,
    produce_to_listeners,
    record_count_metric,
    report_error_to_sentry,
)
from sentry.scm.types import HybridCloudSilo, SubscriptionEvent
from sentry.scm.utils import check_rollout_option

PREFIX = "sentry.scm.produce_event_to_scm_stream"


def produce_event_to_scm_stream(
    event: SubscriptionEvent,
    silo: HybridCloudSilo,
    *,
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
        print("rollout not enabled")
        # return None

    try:
        produce_to_listeners(event, silo, produce_to_listener=produce_to_listener)
        record_count(f"{PREFIX}.success", 1, {})
    except SCMProviderNotSupported:
        print("scm not supported")
        record_count(f"{PREFIX}.failed", 1, {"reason": "not-supported", "provider": event["type"]})
    except Exception as e:
        print("failed", e)
        record_count(f"{PREFIX}.failed", 1, {"reason": "processing"})
        report_error(e)


__all__ = [
    "SubscriptionEvent",
    "produce_event_to_scm_stream",
]
