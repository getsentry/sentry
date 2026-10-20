from enum import StrEnum

from rest_framework.request import Request

from sentry.utils import metrics

ACTIVITY_READ_METRIC = "issues.action_log.activity_read"


class ActivityReadResult(StrEnum):
    """Read-path outcomes, not an inventory of every table queried."""

    #: Direct comment-list reads bypass the GAL gate. Activity owns comment state;
    #: GAL may still supply source metadata.
    ACTIVITY = "activity"
    #: The GAL gate is open and the GAL path is used. For feeds, this combines
    #: Activity comments with non-comment GAL entries.
    GAL = "group_action_log"
    #: The read flag is on, but backfill is incomplete or the log is empty.
    #: Feed callers fall back to Activity for both comments and non-comments.
    FELL_BACK = "fell_back"
    #: The read flag is off. Feed callers use Activity for the entire feed.
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
    Record the source/outcome of an activity read.

    Called once per read: by ``should_serve_action_log_activity`` when the gate closes,
    otherwise by the caller once it knows whether the read produced anything.
    Direct Activity readers report ACTIVITY without consulting the gate.
    """
    tags = {"endpoint": endpoint, "result": result.value}
    if reason is not None:
        tags["reason"] = reason.value
    metrics.incr(ACTIVITY_READ_METRIC, sample_rate=1.0, tags=tags)
