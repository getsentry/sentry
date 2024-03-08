import re
from dataclasses import dataclass, replace

from sentry.sentry_metrics.querying.data.execution import QueryResult
from sentry.sentry_metrics.querying.data.transformation.base import (
    QueryTransformer,
    QueryTransformerResult,
)
from sentry.sentry_metrics.querying.types import QueryOrder


@dataclass(frozen=True)
class FormulaDefinition:
    mql: str
    order: QueryOrder | None
    limit: int | None

    def replace_variables(self, queries: dict[str, str]) -> "FormulaDefinition":
        replaced_mql_formula = self.mql
        # We sort query names by length and content with the goal of trying to always match the longest queries first.
        sorted_query_names = sorted(queries.keys(), key=lambda q: (len(q), q), reverse=True)
        for query_name in sorted_query_names:
            replaced_mql_formula = re.sub(
                rf"\${query_name}", queries.get(query_name, ""), replaced_mql_formula
            )

        return replace(self, mql=replaced_mql_formula)


# TODO: maybe we want to evaluate a form of builder pattern where we can control the
#  chaining of methods, so that we make sure that declaration strictly happens before formula
#  definition.
class MetricsQueriesPlan:
    def __init__(self):
        self._queries: dict[str, str] = {}
        self._formulas: list[FormulaDefinition] = []

    def declare_query(self, name: str, mql: str) -> "MetricsQueriesPlan":
        """
        Declares a query with a name and the mql definition.
        """
        self._queries[name] = mql
        return self

    def apply_formula(
        self, mql: str, order: QueryOrder | None = None, limit: int | None = None
    ) -> "MetricsQueriesPlan":
        """
        Applies an mql formula on the queries that were previously declared.
        """
        self._formulas.append(FormulaDefinition(mql=mql, order=order, limit=limit))
        return self

    def get_replaced_formulas(self) -> list[FormulaDefinition]:
        """
        Returns a list of formulas with the variables replaced with the actual mql query string.

        The usage of a variable in the formulas is with the `$` + the name of the query. The rationale
        behind choosing `$` is to keep the syntax compatible with the MQL syntax, in case we were to embed
        variables resolution in the layer itself.

        This function naively uses string substitution to replace the contents. In case we see it's too
        fragile, we might want to switch to parsing the actual input and mutating the AST.
        """
        return list(map(lambda formula: formula.replace_variables(self._queries), self._formulas))

    def is_empty(self) -> bool:
        """
        A query plan is defined to be empty is no formulas have been applied on it.
        """
        return not self._formulas


@dataclass(frozen=True)
class MetricsQueriesPlanResult:
    results: list[QueryResult]

    def apply_transformer(
        self, transformer: QueryTransformer[QueryTransformerResult]
    ) -> QueryTransformerResult:
        """
        Applies a transformer on the `results` and returns the value of the transformation.
        """
        return transformer.transform(self.results)
