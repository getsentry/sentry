from __future__ import annotations

from datetime import datetime
from typing import Protocol

from sentry.models.project import Project
from sentry.search.events.types import SnubaParams
from sentry.telemetry_classifiers.types import TelemetryInput


class ClassifierDataset(Protocol):
    def compile_filter(self, filter_query: str, snuba_params: SnubaParams) -> str:
        """Compile a classifier filter. Raises InvalidSearchQuery."""
        ...

    def select(
        self, project: Project, filter_query: str, start: datetime, end: datetime, limit: int
    ) -> list[str]:
        """Return IDs of entities whose COOLDOWN ended in ``[start, end)`` and that match the filter.

        That's entities whose last telemetry is in ``[start - COOLDOWN, end - COOLDOWN)``, with
        nothing newer. Consecutive windows select each entity once per period of activity.
        """
        ...

    def load(self, project: Project, entity_id: str) -> TelemetryInput | None:
        """Load an entity's telemetry, or None when it has none to classify."""
        ...
