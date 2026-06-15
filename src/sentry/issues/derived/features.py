from datetime import datetime
from enum import StrEnum

from sentry.issues.derived.framework import EnumCodec, Feature, OptionalCodec


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


# Number of times this issue has been viewed. Not important, mostly here for demonstration purposes.
VIEW_COUNT = Feature[int]("view_count", default=0)

# Status of the issue based on the log.
STATUS = Feature[IssueStatus]("status", default=IssueStatus.OPEN, codec=EnumCodec(IssueStatus))

# The current Progress of the issue.
PROGRESS = Feature[Progress | None](
    "progress", default=Progress.IDENTIFIED, codec=OptionalCodec(EnumCodec(Progress))
)

# The last time the progress was advanced.
LAST_PROGRESSED_AT = Feature[datetime | None]("last_progressed_at", default=None)
