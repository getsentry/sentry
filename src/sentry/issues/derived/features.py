from datetime import datetime
from enum import StrEnum

from sentry.issues.derived.framework import Feature


class IssueStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class Progress(StrEnum):
    """Where an open issue is in the journey toward resolution."""

    IDENTIFIED = "identified"
    TRIAGED = "triaged"
    DIAGNOSED = "diagnosed"
    FIX_PROPOSED = "fix_proposed"
    FIX_APPLIED = "fix_applied"
    REGRESSED = "regressed"


VIEW_COUNT = Feature[int]("view_count", default=0)
STATUS = Feature[str]("status", default=IssueStatus.OPEN)
PROGRESS = Feature[str | None]("progress", default=Progress.IDENTIFIED)
LAST_PROGRESSED_AT = Feature[datetime | None]("last_progressed_at", default=None)
