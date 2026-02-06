import sentry_sdk

from sentry.scm.private.ipc import deserialize_event as _deserialize_event
from sentry.scm.types import SubscriptionEvent


def _report_exception(e: Exception) -> None:
    sentry_sdk.capture_exception(e)


def deserialize_event(event: bytes) -> SubscriptionEvent | None:
    """Return a "SubscriptionEvent" if the event could be parsed."""
    return _deserialize_event(event, report_exception=_report_exception)
