from enum import StrEnum

from sentry.utils import metrics

ACTIVITY_READ_METRIC = "issues.action_log.activity_read"


class ActivityReadEndpoint(StrEnum):
    """Read paths that can serve Activity-shaped responses from the action log."""

    GROUP_DETAILS = "group_details"
    GROUP_ACTIVITIES = "group_activities"
    GROUP_INDEX_UPDATE = "group_index_update"
    GROUP_NOTES = "group_notes"
    GROUP_NOTES_DETAILS = "group_notes_details"


class ActivityReadResult(StrEnum):
    #: The log backed the response.
    GALE = "gale"
    #: The gate was open, or the flag was on, but we served Activity anyway.
    FELL_BACK = "fell_back"
    #: The read flag is off for this project, so the log was never consulted.
    FLAG_OFF = "flag_off"


class ActivityReadReason(StrEnum):
    #: The project is enrolled but its backfill hasn't finished.
    NOT_BACKFILLED = "not_backfilled"
    #: The gate was open and the log came back empty.
    EMPTY_LOG = "empty_log"


def record_activity_read(
    endpoint: ActivityReadEndpoint,
    result: ActivityReadResult,
    reason: ActivityReadReason | None = None,
) -> None:
    tags = {"endpoint": endpoint.value, "result": result.value}
    if reason is not None:
        tags["reason"] = reason.value
    metrics.incr(ACTIVITY_READ_METRIC, sample_rate=1.0, tags=tags)
