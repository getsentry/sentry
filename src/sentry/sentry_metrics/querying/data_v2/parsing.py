from collections.abc import Generator, Sequence

from parsimonious.exceptions import IncompleteParseError
from snuba_sdk.mql.mql import parse_mql
from snuba_sdk.query_visitors import InvalidQueryError

from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.sentry_metrics.querying.data_v2.plan import MetricsQueriesPlan, QueryOrder
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.sentry_metrics.querying.types import QueryExpression
from sentry.sentry_metrics.querying.visitors import (
    EnvironmentsInjectionVisitor,
    FiltersCompositeVisitor,
    LatestReleaseTransformationVisitor,
    QueryExpressionVisitor,
    ValidationV2Visitor,
)


class VisitableQueryExpression:
    def __init__(self, query: QueryExpression):
        self._query = query
        self._visitors: list[QueryExpressionVisitor[QueryExpression]] = []

    def add_visitor(
        self, visitor: QueryExpressionVisitor[QueryExpression]
    ) -> "VisitableQueryExpression":
        """
        Adds a visitor to the query expression.

        The visitor can both perform mutations or not on the expression tree.
        """
        self._visitors.append(visitor)

        return self

    def get(self) -> QueryExpression:
        """
        Returns the mutated query expression after running all the visitors
        in the order of definition.

        Order preservation does matter, since downstream visitors might work under the
        assumption that upstream visitors have already been run.
        """
        query = self._query
        for visitor in self._visitors:
            query = visitor.visit(query)

        return query


class QueryParser:
    def __init__(
        self,
        projects: Sequence[Project],
        environments: Sequence[Environment],
        metrics_queries_plan: MetricsQueriesPlan,
    ):
        self._projects = projects
        self._environments = environments
        self._metrics_queries_plan = metrics_queries_plan

    def _parse_mql(self, mql: str) -> VisitableQueryExpression:
        """
        Parses the field with the MQL grammar.
        """
        try:
            query = parse_mql(mql).query
        except InvalidQueryError as e:
            cause = e.__cause__
            if cause and isinstance(cause, IncompleteParseError):
                error_context = cause.text[cause.pos : cause.pos + 20]
                # We expose the entire MQL string to give more context when solving the error, since in the future we
                # expect that MQL will be directly fed into the endpoint instead of being built from the supplied
                # fields.
                raise InvalidMetricsQueryError(
                    f"The query '{mql}' could not be matched starting from '{error_context}...'"
                )

            raise InvalidMetricsQueryError("The supplied query is not valid")

        return VisitableQueryExpression(query=query)

    def generate_queries(
        self,
    ) -> Generator[tuple[QueryExpression, QueryOrder | None, int | None], None, None]:
        """
        Generates multiple timeseries queries given a base query.
        """
        for formula_definition in self._metrics_queries_plan.get_replaced_formulas():
            query_expression = (
                self._parse_mql(formula_definition.mql)
                # We validate the query.
                .add_visitor(ValidationV2Visitor())
                # We inject the environment filter in each timeseries.
                .add_visitor(EnvironmentsInjectionVisitor(self._environments))
                # We transform all `release:latest` filters into the actual latest releases.
                .add_visitor(
                    FiltersCompositeVisitor(LatestReleaseTransformationVisitor(self._projects))
                ).get()
            )
            # TODO: check if we want to use a better data structure for returning queries.
            yield query_expression, formula_definition.order, formula_definition.limit
