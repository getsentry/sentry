from enum import StrEnum

from sentry.issues.derived.framework import (
    BoolCodec,
    DateTimeCodec,
    EnumCodec,
    Feature,
    IntCodec,
    IntListCodec,
    OptionalCodec,
)
from sentry.issues.progress_state import IssueProgressState
from sentry.types.group import IssueAutofixStep, IssueBlocker


class IssueStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


# Number of times this issue has been viewed. Not important, mostly here for demonstration purposes.
VIEW_COUNT = Feature("view_count", default=0, codec=IntCodec())

# Status of the issue based on the log.
STATUS = Feature("status", default=IssueStatus.OPEN, codec=EnumCodec(IssueStatus), version=2)

# IDs of the first 20 ReconcileStatusActions whose target equaled the current status.
# Never cleared. Used to find reconciles that can be deleted while keeping storage bounded.
NO_CHANGE_RECONCILE_IDS = Feature(
    "no_change_reconcile_ids", default_factory=list, codec=IntListCodec()
)

# The current Progress of the issue.
PROGRESS = Feature(
    "progress",
    default=IssueProgressState.IDENTIFIED,
    codec=OptionalCodec(EnumCodec(IssueProgressState)),
    version=2,
)

# The last time the progress was advanced.
LAST_PROGRESSED_AT = Feature(
    "last_progressed_at", default=None, codec=OptionalCodec(DateTimeCodec())
)

# Whether the issue currently has an open PR linked to the issue.
HAS_OPEN_FIX_PR = Feature("has_open_fix_pr", default=False, codec=BoolCodec())

# Whether the issue currently has an assignee.
IS_ASSIGNED = Feature("is_assigned", default=False, codec=BoolCodec())

# Whether the issue has a root cause identified.
HAS_ROOT_CAUSE = Feature("has_root_cause", default=False, codec=BoolCodec())

# The furthest autofix step the issue has reached, from the latest completed
LAST_COMPLETED_AUTOFIX_STEP = Feature(
    "last_completed_autofix_step", default=IssueAutofixStep.NONE, codec=EnumCodec(IssueAutofixStep)
)

# The current action blocking the issue's progress toward resolution.
BLOCKER = Feature("blocker", default=IssueBlocker.NONE, codec=EnumCodec(IssueBlocker))
