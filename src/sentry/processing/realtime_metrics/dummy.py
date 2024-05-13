import logging
from typing import Any

from . import base

logger = logging.getLogger(__name__)


class DummyRealtimeMetricsStore(base.RealtimeMetricsStore):
    def __init__(self, **kwargs: Any) -> None:
        pass

    def record_project_duration(self, project_id: int, duration: float) -> None:
        pass

    def is_lpq_project(self, project_id: int) -> bool:
        return False
