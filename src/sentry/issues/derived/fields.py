"""
Derived state field declarations.

Each Field is a named, typed slot in the derived state with a default value.
Fields with rich types use a Codec for JSON round-tripping.
"""

from enum import StrEnum

from pydantic import BaseModel

from sentry.issues.derived.lib import Field, PydanticDictCodec


class IssueStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class FetchInfo(BaseModel):
    ts: float
    tool: str | None = None

    class Config:
        frozen = True


class WorkingOnEntry(BaseModel):
    since: float
    tool: str | None = None

    class Config:
        frozen = True


LAST_SEEN = Field[float | None]("last_seen", default=None)
VIEW_COUNT = Field[int]("view_count", default=0)
STATUS = Field[str]("status", default=IssueStatus.OPEN)
LAST_OPENED = Field[float | None]("last_opened", default=None)

# dict of user_id (str) -> last view epoch. Keyed by str because JSON keys must be strings.
RECENT_VIEWERS = Field[dict[str, float]]("recent_viewers", default_factory=dict)

RECENT_FETCHED = Field[dict[str, FetchInfo]](
    "recent_fetched",
    default_factory=dict,
    codec=PydanticDictCodec(FetchInfo),
)

WORKING_ON = Field[dict[str, WorkingOnEntry]](
    "working_on",
    default_factory=dict,
    codec=PydanticDictCodec(WorkingOnEntry),
)

# PR IDs created by autofix.
AUTOFIX_PRS = Field[list[str]]("autofix_prs", default_factory=list)

# PRs that have resulted in this issue being closed. Cleared on reopen.
CLOSING_PRS = Field[list[str]]("closing_prs", default_factory=list)

WAS_AUTOFIXED = Field[bool]("was_autofixed", default=False)
