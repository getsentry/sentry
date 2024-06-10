import logging
from typing import Any

from sentry.lang.native.symbolicator import SymbolicatorPlatform

from . import base

logger = logging.getLogger(__name__)


class DummyRealtimeMetricsStore(base.RealtimeMetricsStore):
    def __init__(self, **kwargs: Any) -> None:
        pass

    def validate(self) -> None:
        pass

    def record_project_duration(
        self, platform: SymbolicatorPlatform, project_id: int, duration: float
    ) -> None:
        pass

    def is_lpq_project(self, platform: SymbolicatorPlatform, project_id: int) -> bool:
        return False
