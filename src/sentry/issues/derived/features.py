from datetime import datetime
from enum import StrEnum

from sentry.issues.derived.framework import DateTimeCodec, EnumCodec, Feature, OptionalCodec
from sentry.issues.progress_state import IssueProgressState


class IssueStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


# Number of times this issue has been viewed. Not important, mostly here for demonstration purposes.
VIEW_COUNT = Feature[int]("view_count", default=0)

# Status of the issue based on the log.
STATUS = Feature[IssueStatus]("status", default=IssueStatus.OPEN, codec=EnumCodec(IssueStatus))

# The current Progress of the issue.
PROGRESS = Feature[IssueProgressState | None](
    "progress",
    default=IssueProgressState.IDENTIFIED,
    codec=OptionalCodec(EnumCodec(IssueProgressState)),
)

# The last time the progress was advanced.
LAST_PROGRESSED_AT = Feature[datetime | None](
    "last_progressed_at", default=None, codec=OptionalCodec(DateTimeCodec())
)

# Whether the issue currently has an open PR linked to the issue.
HAS_OPEN_FIX_PR = Feature[bool]("has_open_fix_pr", default=False)

# Whether the issue currently has an assignee.
IS_ASSIGNED = Feature[bool]("is_assigned", default=False)

# Whether the issue has a root cause identified.
HAS_ROOT_CAUSE = Feature[bool]("has_root_cause", default=False)
