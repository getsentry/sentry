from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Generic, List, Mapping, Optional, Tuple, TypeVar


class TrendType(Enum):
    Regressed = "regressed"
    Improved = "improved"
    Unchanged = "unchanged"


@dataclass(frozen=True)
class DetectorPayload:
    project_id: int
    group: str | int
    count: float
    value: float
    timestamp: datetime


@dataclass(frozen=True)
class DetectorState(ABC):
    @classmethod
    @abstractmethod
    def from_redis_dict(cls, data: Any) -> DetectorState:
        ...

    @abstractmethod
    def to_redis_dict(self) -> Mapping[str | bytes, bytes | float | int | str]:
        ...


@dataclass(frozen=True)
class DetectorConfig(ABC):
    ...


C = TypeVar("C")
T = TypeVar("T")


class DetectorStore(ABC, Generic[T]):
    @abstractmethod
    def bulk_read_states(self, payloads: List[DetectorPayload]) -> List[T]:
        ...

    @abstractmethod
    def bulk_write_states(self, payloads: List[DetectorPayload], states: List[T]):
        ...


class DetectorAlgorithm(ABC, Generic[T]):
    @abstractmethod
    def update(self, payload: DetectorPayload) -> Tuple[Optional[TrendType], float]:
        ...
