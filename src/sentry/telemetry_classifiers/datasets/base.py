from __future__ import annotations

from datetime import datetime, timedelta
from typing import Protocol

from sentry.constants import DataCategory
from sentry.models.project import Project
from sentry.search.events.types import SnubaParams
from sentry.telemetry_classifiers.types import TelemetryInput


class ClassifierDataset(Protocol):
    # How long an entity must go without new telemetry before it's classified.
    cooldown: timedelta
    # The kind of telemetry entities are made of. Results keep its retention.
    data_category: DataCategory

    def compile_filter(self, filter_query: str, snuba_params: SnubaParams) -> str:
        """Compile a classifier filter. Raises InvalidSearchQuery."""
        ...

    def select(
        self,
        project: Project,
        filter_query: str,
        start: datetime,
        end: datetime,
        limit: int,
        offset: int,
    ) -> list[str]:
        """Return a page of IDs of entities whose cooldown ended in ``[start, end)`` and that match the
        filter.

        That's entities whose last telemetry is in ``[start - cooldown, end - cooldown)``, with
        nothing newer. The newest entities come first.
        """
        ...

    def load(self, project: Project, entity_id: str) -> TelemetryInput | None:
        """Load an entity's telemetry, or None when it has none to classify."""
        ...
