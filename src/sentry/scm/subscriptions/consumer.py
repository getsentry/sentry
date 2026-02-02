import sentry_sdk

from sentry.scm.private.ipc import deserialize_event as _deserialize_event
from sentry.scm.subscriptions.types import SubscriptionEvent


def deserialize_event(event: bytes) -> SubscriptionEvent | None:
    """Return a "SubscriptionEvent" if the event could be parsed."""
    return _deserialize_event(event, report_exception=lambda e: sentry_sdk.capture_exception(e))
