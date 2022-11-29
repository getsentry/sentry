import logging
from typing import Any, Iterable, Set

from . import base

logger = logging.getLogger(__name__)


class DummyRealtimeMetricsStore(base.RealtimeMetricsStore):
    def __init__(self, **kwargs: Any) -> None:
        pass

    def record_project_duration(self, project_id: int, duration: float) -> None:
        pass

    def projects(self) -> Iterable[int]:
        yield from ()

    def get_used_budget_for_project(self, project_id: int) -> float:
        return 0.0

    def get_lpq_projects(self) -> Set[int]:
        return set()

    def is_lpq_project(self, project_id: int) -> bool:
        return False

    def add_project_to_lpq(self, project_id: int) -> bool:
        return False

    def remove_projects_from_lpq(self, project_ids: Set[int]) -> int:
        return 0
