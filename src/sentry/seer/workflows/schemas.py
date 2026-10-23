from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Literal, NotRequired, TypedDict

from pydantic import BaseModel

from sentry.seer.models.workflow import SeerWorkflowFilters, SeerWorkflowStrategy

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


class WorkflowSnapshotFilters(SeerWorkflowFilters):
    class Config:
        extra = "allow"


class WorkflowRunSnapshot(BaseModel):
    config_version: int
    strategy: SeerWorkflowStrategy
    filters: WorkflowSnapshotFilters
    project_ids: tuple[int, ...]
    output_policy: dict[str, Any]
    inputs: dict[str, Any]

    class Config:
        allow_mutation = False


class WorkflowRunError(BaseModel):
    code: str
    message: str
