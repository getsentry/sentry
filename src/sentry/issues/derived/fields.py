from enum import StrEnum

from pydantic import BaseModel

from sentry.issues.derived.lib import Feature, FrozenSetCodec, PydanticDictCodec


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
    FIX_DEPLOYED = "fix_deployed"
    REGRESSED = "regressed"


class WorkingOnEntry(BaseModel):
    since: float

    class Config:
        frozen = True


VIEW_COUNT = Feature[int]("view_count", default=0)
STATUS = Feature[str]("status", default=IssueStatus.OPEN)
LAST_OPENED = Feature[float | None]("last_opened", default=None)

# dict of user_id (str) -> last view epoch. Keyed by str because JSON keys must be strings.
RECENT_VIEWERS = Feature[dict[str, float]]("recent_viewers", default_factory=dict)

WORKING_ON = Feature[dict[str, WorkingOnEntry]](
    "working_on",
    default_factory=dict,
    codec=PydanticDictCodec(WorkingOnEntry),
)

# PR IDs created by autofix.
AUTOFIX_PRS = Feature[frozenset[str]](
    "autofix_prs",
    default_factory=frozenset,
    codec=FrozenSetCodec(),
)

# PRs that have resulted in this issue being closed. Cleared on reopen.
CLOSING_PRS = Feature[frozenset[str]](
    "closing_prs",
    default_factory=frozenset,
    codec=FrozenSetCodec(),
)

WAS_AUTOFIXED = Feature[bool]("was_autofixed", default=False)

PROGRESS = Feature[str | None]("progress", default=Progress.IDENTIFIED)
