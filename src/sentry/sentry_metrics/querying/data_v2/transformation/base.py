from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from sentry.sentry_metrics.querying.data_v2.execution import QueryResult

QueryTransformerResult = TypeVar("QueryTransformerResult")


class QueryResultsTransformer(ABC, Generic[QueryTransformerResult]):
    """
    Represents an abstract transformer that can transform QueryResult objects.
    """

    @abstractmethod
    def transform(self, query_results: list[QueryResult]) -> QueryTransformerResult:
        """
        Transforms the supplied query results into a QueryTransformerResult.

        Returns:
            The transformed query result which can be of any type.
        """

        raise NotImplementedError
