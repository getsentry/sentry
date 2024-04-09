import logging
from collections.abc import Iterable
from typing import Any

from . import base

logger = logging.getLogger(__name__)


class DummyRealtimeMetricsStore(base.RealtimeMetricsStore):
    def __init__(self, **kwargs: Any) -> None:
        pass

    def validate(self) -> None:
        pass

    def record_project_duration(self, project_id: int, duration: float) -> None:
        pass

    def projects(self) -> Iterable[int]:
        yield from ()

    def get_used_budget_for_project(self, project_id: int) -> float:
        return 0.0

    def get_lpq_projects(self) -> set[int]:
        return set()

    def is_lpq_project(self, project_id: int) -> bool:
        return False

    def add_project_to_lpq(self, project_id: int) -> bool:
        return False

    def remove_projects_from_lpq(self, project_ids: set[int]) -> int:
        return 0
