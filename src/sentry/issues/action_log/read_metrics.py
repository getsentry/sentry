from enum import StrEnum

from rest_framework.request import Request

from sentry.utils import metrics

ACTIVITY_READ_METRIC = "issues.action_log.activity_read"


class ActivityReadResult(StrEnum):
    #: The log backed the response.
    GAL = "group_action_log"
    #: The gate was open, or the flag was on, but we served Activity anyway.
    FELL_BACK = "fell_back"
    #: The read flag is off for this project, so the log was never consulted.
    FLAG_OFF = "flag_off"


class ActivityReadFallbackReason(StrEnum):
    #: The project is enrolled but its backfill hasn't finished.
    NOT_BACKFILLED = "not_backfilled"
    #: The gate was open and the log came back empty.
    EMPTY_LOG = "empty_log"


def activity_read_endpoint(request: Request) -> str:
    """The route being served, for the `endpoint` tag."""
    if request.resolver_match is None or request.resolver_match.url_name is None:
        return "unknown"
    return request.resolver_match.url_name


def record_activity_read(
    endpoint: str,
    result: ActivityReadResult,
    reason: ActivityReadFallbackReason | None = None,
) -> None:
    """
    Record the outcome of one attempt to serve activity from the action log.

    Called once per read: by ``should_serve_action_log_activity`` when the gate closes,
    otherwise by the caller once it knows whether the read produced anything.
    """
    tags = {"endpoint": endpoint, "result": result.value}
    if reason is not None:
        tags["reason"] = reason.value
    metrics.incr(ACTIVITY_READ_METRIC, sample_rate=1.0, tags=tags)
