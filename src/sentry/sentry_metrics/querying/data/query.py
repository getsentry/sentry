from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, cast

from sentry.sentry_metrics.querying.data.execution import QueryResult
from sentry.sentry_metrics.querying.data.transformation.base import (
    QueryResultsTransformer,
    QueryTransformerResult,
)
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.sentry_metrics.querying.types import QueryOrder


class MQLQuery:
    """
    Represents an MQL query that can be run against Snuba.

    Example:
    # Defining a simple query.
    query = MQLQuery("avg(d:transactions/duration@millisecond)", order=QueryOrder.ASC, limit=10)

    # Defining more complex queries that depend on each other.
    query_1 = MQLQuery("avg(d:transactions/duration@millisecond)")
    query_2 = MQLQuery("sum(d:transactions/duration@millisecond)")
    query = MQLQuery("$query_1 / $query_2", order=QueryOrder.ASC, query_1=query_1, query_2=query_2)
    """

    def __init__(
        self, mql: str, order: QueryOrder | None = None, limit: int | None = None, **sub_queries
    ):
        self.mql = mql
        self.order = order
        self.limit = limit
        self.sub_queries = self._validate_sub_queries(sub_queries)

    @staticmethod
    def _validate_sub_queries(sub_queries: Mapping[str, Any]) -> Mapping[str, "MQLQuery"]:
        for name, query in sub_queries.items():
            if not isinstance(query, MQLQuery):
                raise InvalidMetricsQueryError("A subquery must be an instance of 'MQLQuery'")

        return cast(Mapping[str, MQLQuery], sub_queries)

    def compile(self) -> "MQLQuery":
        """
        Compiles the MQL query by replacing all variables inside the formulas with the corresponding queries.

        For example, a formula in the form "$a + $b" with queries "a: max(mri_1), b: min(mri_2)" will become
        "max(mri_1) + min(mri_2)".

        The rationale for having queries being defined as variables in formulas is to have a structure which is more
        flexible and allows reuse of the same query across multiple formulas.

        Returns:
            A new MQLQuery with the MQL string containing the replaced formula.
        """
        sub_queries = {name: query.compile() for name, query in self.sub_queries.items()}
        replaced_mql_formula = self.mql

        # We sort query names by length and content with the goal of trying to always match the longest queries first.
        sorted_query_names = sorted(sub_queries.keys(), key=lambda q: (len(q), q), reverse=True)
        for query_name in sorted_query_names:
            replaced_mql_formula = replaced_mql_formula.replace(
                f"${query_name}", sub_queries[query_name].mql
            )

        return MQLQuery(mql=replaced_mql_formula, order=self.order, limit=self.limit)


@dataclass(frozen=True)
class MQLQueriesResult:
    """
    Represents a wrapper around the results of a list of MQLQuery(s) which exposes useful methods to run on the query
    results.
    """

    results: list[QueryResult]

    def apply_transformer(
        self, transformer: QueryResultsTransformer[QueryTransformerResult]
    ) -> QueryTransformerResult:
        """
        Applies a transformer on the `results` and returns the value of the transformation.
        """
        return transformer.transform(self.results)
