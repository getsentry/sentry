"""Replayable, project-scoped anomaly transition."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sentry.workflow_engine.types import DetectorPriorityLevel


@dataclass(frozen=True)
class AnomalyTransition:
    group_key: str
    project_id: int
    timestamp: datetime
    priority: DetectorPriorityLevel
    is_resolved: bool
    title: str
    # Internal correlation evidence may describe other projects. Never publish it.
    evidence: Mapping[str, object] = field(repr=False)
    env: str = ""

    @property
    def timestamp_utc(self) -> datetime:
        if self.timestamp.tzinfo is None:
            return self.timestamp.replace(tzinfo=UTC)
        return self.timestamp.astimezone(UTC)
