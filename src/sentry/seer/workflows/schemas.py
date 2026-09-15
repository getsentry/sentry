from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Literal, NotRequired, TypedDict

WorkflowRunSource = Literal["cron", "manual"]
WorkflowRunStatus = Literal["running", "complete", "partial", "failed"]


class WorkflowRunExtras(TypedDict):
    source: NotRequired[WorkflowRunSource]
    status: WorkflowRunStatus
    error: str | None


@dataclass(frozen=True)
class WorkflowResult:
    extras: Mapping[str, Any] = field(default_factory=dict)
    status: Literal["complete", "partial"] = "complete"


class WorkflowResultError(Exception):
    """A result processing failure with a message safe to show to the user."""
