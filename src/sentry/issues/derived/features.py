from datetime import datetime
from enum import IntFlag, StrEnum

from sentry.issues.derived.framework import DateTimeCodec, EnumCodec, Feature, OptionalCodec
from sentry.issues.progress_state import IssueProgressState
from sentry.types.group import IssueAutofixStep, IssueBlocker


class IssueStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


# Number of times this issue has been viewed. Not important, mostly here for demonstration purposes.
VIEW_COUNT = Feature[int]("view_count", default=0)

# Status of the issue based on the log.
STATUS = Feature[IssueStatus](
    "status", default=IssueStatus.OPEN, codec=EnumCodec(IssueStatus), version=2
)

# The current Progress of the issue.
PROGRESS = Feature[IssueProgressState | None](
    "progress",
    default=IssueProgressState.IDENTIFIED,
    codec=OptionalCodec(EnumCodec(IssueProgressState)),
    version=2,
)

# The last time the progress was advanced.
LAST_PROGRESSED_AT = Feature[datetime | None](
    "last_progressed_at", default=None, codec=OptionalCodec(DateTimeCodec())
)

# Whether the issue currently has an open PR linked to the issue.
HAS_OPEN_FIX_PR = Feature[bool]("has_open_fix_pr", default=False)


class FixAttemptSignal(IntFlag):
    """Facts about fix attempts collected ahead of the derived-data cutover."""

    NONE = 0
    HAS_OPEN_PR = 1 << 0
    HAS_FAILED_AUTOMATED_FIX = 1 << 1


FIX_ATTEMPT_SIGNALS = Feature[int]("fix_attempt_signals", default=FixAttemptSignal.NONE.value)

# Whether the issue currently has an assignee.
IS_ASSIGNED = Feature[bool]("is_assigned", default=False)

# Whether the issue has a root cause identified.
HAS_ROOT_CAUSE = Feature[bool]("has_root_cause", default=False)

# The furthest autofix step the issue has reached, from the latest completed
LAST_COMPLETED_AUTOFIX_STEP = Feature[IssueAutofixStep](
    "last_completed_autofix_step", default=IssueAutofixStep.NONE, codec=EnumCodec(IssueAutofixStep)
)

# The current action blocking the issue's progress toward resolution.
BLOCKER = Feature[IssueBlocker]("blocker", default=IssueBlocker.NONE, codec=EnumCodec(IssueBlocker))
