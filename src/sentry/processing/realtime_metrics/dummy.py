import logging
from typing import Any, Iterable, Set

from . import base

logger = logging.getLogger(__name__)


class DummyRealtimeMetricsStore(base.RealtimeMetricsStore):
    def __init__(self, **kwargs: Any) -> None:
        pass

    def increment_project_event_counter(self, project_id: int, timestamp: int) -> None:
        pass

    def increment_project_duration_counter(
        self, project_id: int, timestamp: int, duration: int
    ) -> None:
        pass

    def projects(self) -> Iterable[int]:
        yield from ()

    def get_counts_for_project(self, project_id: int, timestamp: int) -> base.BucketedCounts:
        return base.BucketedCounts(timestamp=-1, width=0, counts=[])

    def get_durations_for_project(
        self, project_id: int, timestamp: int
    ) -> base.BucketedDurationsHistograms:
        return base.BucketedDurationsHistograms(timestamp=-1, width=0, histograms=[])

    def get_lpq_projects(self) -> Set[int]:
        return set()

    def is_lpq_project(self, project_id: int) -> bool:
        return False

    def add_project_to_lpq(self, project_id: int) -> bool:
        return False

    def remove_projects_from_lpq(self, project_ids: Set[int]) -> int:
        return 0
