from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from sentry.db.models.base import Model
from sentry.organizations.services.organization import RpcOrganization

from .store import PipelineSessionStore


@dataclass
class PipelineRequestState[M: Model, S: PipelineSessionStore]:
    """Initial pipeline attributes from a request."""

    state: S
    provider_model: M | None
    organization: RpcOrganization | None
    provider_key: str


@dataclass
class PipelineAnalyticsEntry:
    """Attributes to describe a pipeline in analytics records."""

    event_type: str
    pipeline_type: str


class PipelineStepAction(str, Enum):
    ADVANCE = "advance"
    STAY = "stay"
    ERROR = "error"
    COMPLETE = "complete"


@dataclass
class PipelineStepResult:
    action: PipelineStepAction
    data: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def advance(cls) -> PipelineStepResult:
        return cls(action=PipelineStepAction.ADVANCE)

    @classmethod
    def stay(cls, data: dict[str, Any] | None = None) -> PipelineStepResult:
        return cls(action=PipelineStepAction.STAY, data=data or {})

    @classmethod
    def error(cls, message: str) -> PipelineStepResult:
        return cls(action=PipelineStepAction.ERROR, data={"detail": message})

    @classmethod
    def complete(cls, data: dict[str, Any] | None = None) -> PipelineStepResult:
        return cls(action=PipelineStepAction.COMPLETE, data=data or {})

    def serialize(self) -> dict[str, Any]:
        result: dict[str, Any] = {"status": self.action.value}
        if self.data:
            result["data"] = self.data
        return result
