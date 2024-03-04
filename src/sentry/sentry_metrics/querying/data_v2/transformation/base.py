from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from sentry.sentry_metrics.querying.data_v2.execution import QueryResult

QueryTransformerResult = TypeVar("QueryTransformerResult")


class QueryTransformer(ABC, Generic[QueryTransformerResult]):
    @abstractmethod
    def transform(self, query_results: list[QueryResult]) -> QueryTransformerResult:
        raise NotImplementedError
