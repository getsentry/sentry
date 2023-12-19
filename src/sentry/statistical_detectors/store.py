from abc import ABC, abstractmethod
from typing import Generic, List, TypeVar

from sentry.statistical_detectors.base import DetectorPayload

T = TypeVar("T")


class DetectorStore(ABC, Generic[T]):
    @abstractmethod
    def bulk_read_states(self, payloads: List[DetectorPayload]) -> List[T]:
        ...

    @abstractmethod
    def bulk_write_states(self, payloads: List[DetectorPayload], states: List[T]):
        ...
