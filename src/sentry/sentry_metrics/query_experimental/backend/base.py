from abc import ABC, abstractmethod
from typing import Generic, List, TypeVar

from ..types import SeriesQuery, SeriesResult

TRequest = TypeVar("TRequest")


class MetricsBackend(ABC, Generic[TRequest]):
    """
    Base class for metrics storage backends.
    """

    @abstractmethod
    def create_request(self, query: SeriesQuery) -> TRequest:
        """
        Create a request object for the backend from a query. This request can
        be used later to execute the query on the backend.
        """
        raise NotImplementedError()

    @abstractmethod
    def execute(self, request: TRequest) -> SeriesResult:
        """
        Execute a request and return the result.
        """
        raise NotImplementedError()

    def bulk_execute(self, requests: List[TRequest]) -> List[SeriesResult]:
        """
        Execute a list of requests in bulk.

        The default implementation forwards to :meth:`execute` for each request.
        """
        return [self.execute(request) for request in requests]

    def query(self, query: SeriesQuery) -> SeriesResult:
        """
        Execute a query and return the result.

        The default implementation creates a request and forwards to
        :meth:`execute`.
        """
        return self.execute(self.create_request(query))

    def bulk_query(self, queries: List[SeriesQuery]) -> List[SeriesResult]:
        """
        Execute a list of queries in bulk.

        The default implementation creates requets for every query and forwards
        to :meth:`bulk_execute`.
        """
        return self.bulk_execute([self.create_request(query) for query in queries])
