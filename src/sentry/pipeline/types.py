from dataclasses import dataclass

from sentry.models import Model, Organization

from .store import PipelineSessionStore


@dataclass
class PipelineRequestState:
    """Initial pipeline attributes from a request."""

    state: PipelineSessionStore
    provider_model: Model
    organization: Organization
    provider_key: str


@dataclass
class PipelineAnalyticsEntry:
    """Attributes to describe a pipeline in analytics records."""

    event_type: str
    pipeline_type: str
