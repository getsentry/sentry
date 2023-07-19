"""
In-memory evaluation of calculations on top of results from multiple metrics
queries.
"""

# TODO: Evaluator function or class
# TODO: Calculation dataclass

from typing import Dict, Sequence

from sentry.sentry_metrics.query_experimental.types import SeriesQuery, SeriesResult


class Calculation:
    """
    A calculation is a set of queries that are evaluated together to produce a
    result.
    """

    def __init__(self, queries: Sequence[SeriesQuery]) -> None:
        self.queries = set(queries)
        self.results: Dict[SeriesQuery, SeriesResult] = {}

    def add_result(self, query: SeriesQuery, result: SeriesResult) -> None:
        self.results[query] = result

    def evaluate(self) -> SeriesResult:
        """
        Evaluate the calculation and return the result.
        """
        if len(self.queries) != 1:
            raise NotImplementedError("Multiple queries not supported yet")

        # TODO: Support more than one query
        query = next(iter(self.queries))
        result = self.results.get(query)
        if result is None:
            raise ValueError("Missing result for query")

        return result


def generate_calculation(query: SeriesQuery) -> Calculation:
    """
    Generate a calculation from a query.
    """
    return Calculation([query])
