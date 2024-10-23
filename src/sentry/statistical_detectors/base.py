from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any


class TrendType(Enum):
    Regressed = "regressed"
    Improved = "improved"
    Unchanged = "unchanged"
    Skipped = "skipped"


@dataclass(frozen=True)
class DetectorPayload:
    project_id: int
    group: str | int
    fingerprint: str
    count: float
    value: float
    timestamp: datetime


@dataclass(frozen=True)
class DetectorState(ABC):
    @classmethod
    @abstractmethod
    def from_redis_dict(cls, data: Any) -> DetectorState: ...

    @abstractmethod
    def to_redis_dict(self) -> Mapping[str | bytes, bytes | float | int | str]: ...

    @abstractmethod
    def should_auto_resolve(self, target: float, rel_threshold: float) -> bool: ...

    @abstractmethod
    def should_escalate(
        self, baseline: float, regressed: float, min_change: float, rel_threshold: float
    ) -> bool: ...

    @classmethod
    @abstractmethod
    def empty(cls) -> DetectorState: ...

    @abstractmethod
    def get_moving_avg(self) -> float: ...
