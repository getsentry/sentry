from __future__ import annotations

from dataclasses import dataclass

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
