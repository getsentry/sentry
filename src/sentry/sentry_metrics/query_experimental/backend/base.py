from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from sentry.sentry_metrics.query_experimental.types import SeriesQuery, SeriesResult

TRequest = TypeVar("TRequest")


class MetricsBackend(ABC, Generic[TRequest]):
    @abstractmethod
    def create_request(self, query: SeriesQuery) -> TRequest:
        raise NotImplementedError()

    @abstractmethod
    def query(self, query: SeriesQuery) -> SeriesResult:
        raise NotImplementedError()
