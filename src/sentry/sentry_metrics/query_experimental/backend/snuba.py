from typing import Any, List, Sequence, Set, Union

from snuba_sdk import Column, Condition, Entity, Mapping, Op
from snuba_sdk import Query as SnubaQuery
from snuba_sdk import Request as SnubaRequest
from snuba_sdk import SelectableExpression

from sentry.sentry_metrics.query_experimental.types import SeriesQuery, SeriesResult
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics.naming_layer import parse_mri
from sentry.snuba.metrics.utils import TS_COL_QUERY
from sentry.utils.snuba import raw_snql_query

from .base import MetricsBackend
from .transform import QueryVisitor
from .types import FILTER, AggregationFn, ArithmeticFn, Expression, Function, InvalidMetricsQuery
from .use_case import UseCaseID, get_use_case

COLUMN_PROJECT_ID = Column("project_id")
COLUMN_ORG_ID = Column("org_id")
COLUMN_TIMESTAMP = Column(TS_COL_QUERY)
COLUMN_VALUE = Column("value")
COLUMN_METRIC_ID = Column("metric_id")


TYPE_TO_ENTITY: Mapping[str, Entity] = {
    "c": Entity(EntityKey.MetricsCounters),
    "d": Entity(EntityKey.MetricsDistributions),
    "s": Entity(EntityKey.MetricsSets),
}
LEGACY_TYPE_TO_ENTITY: Mapping[str, Entity] = {
    "c": Entity(EntityKey.GenericMetricsCounters),
    "d": Entity(EntityKey.GenericMetricsDistributions),
    "s": Entity(EntityKey.GenericMetricsSets),
}

SNQL_AGGREGATES: Mapping[str, str] = {
    AggregationFn.SUM: "sumIf",
    AggregationFn.COUNT: "countIf",
    AggregationFn.AVG: "avgIf",
    AggregationFn.MAX: "maxIf",
    AggregationFn.MIN: "minIf",
    AggregationFn.P50: "quantilesIf(0.5)",
    AggregationFn.P75: "quantilesIf(0.75)",
    AggregationFn.P95: "quantilesIf(0.95)",
    AggregationFn.P99: "quantilesIf(0.99)",
}
CONDITION_TO_FUNCTION = {
    Op.EQ: "equals",
    Op.NEQ: "notEquals",
    Op.LIKE: "like",
    Op.NOT_LIKE: "notLike",
    Op.IN: "in",
    Op.NOT_IN: "notIn",
}


def _is_legacy_use_case(use_case: UseCaseID) -> bool:
    return use_case == UseCaseID.SESSIONS


class SnubaMetricsBackend(MetricsBackend[SnubaRequest]):
    def create_request(self, query: SeriesQuery) -> SnubaRequest:
        """
        Generate a SnQL query from a metric series query.
        """

        snuba_query = SnubaQuery(
            match=get_entity(query),
            select=self._get_select(query),
            groupby=None,  # TODO
            where=self._get_where(query),
            granularity=None,  # TODO
        )

        return SnubaRequest(
            dataset="metrics",  # TODO: resolve dataset
            app_id="default",
            query=snuba_query,
            tenant_ids={"organization_id": query.scope.org_id},
        )

    def query(self, query: SeriesQuery) -> SeriesResult:
        request = self.create_request(query)
        snuba_results = raw_snql_query(request, use_cache=False, referrer="sentry_metrics.query")
        assert snuba_results, "silence flake8"
        # TODO: Get necessary subset of SnubaResultConverter
        raise NotImplementedError()

    def _get_select(self, query: SeriesQuery) -> Sequence[SelectableExpression]:
        return [self._convert_expression(e) for e in query.expressions]

    def _get_where(self, query: SeriesQuery) -> Sequence[Condition]:
        where = [
            Condition(COLUMN_ORG_ID, Op.EQ, query.scope.org_id),
            Condition(COLUMN_TIMESTAMP, Op.GTE, query.start),
            Condition(COLUMN_TIMESTAMP, Op.LT, query.end),
        ]

        if query.scope.project_ids:
            where.append(Condition(COLUMN_PROJECT_ID, Op.IN, query.scope.project_ids))

        for filt in query.filters:
            where.append(self._convert_condition(filt))

        return where

    def _convert_expression(self, expression: Expression) -> SelectableExpression:
        if isinstance(expression, Function):
            if expression.function in ArithmeticFn:
                return Function(
                    function=expression.function,
                    parameters=[self._convert_expression(p) for p in expression.parameters],
                )
            elif expression.function in AggregationFn:
                return self._convert_aggregate(expression)
        raise NotImplementedError()

    def _convert_aggregate(self, function: Function) -> SelectableExpression:
        if function.function not in SNQL_AGGREGATES:
            raise InvalidMetricsQuery(f"Unsupported aggregate function {function.function}")

        if len(function.parameters) != 1:
            raise InvalidMetricsQuery("Aggregate functions must have exactly one parameter")

        filters = self._collect_aggregate(function.parameters[0])
        if len(filters) == 1:
            parameter = filters[0]
        else:
            parameter = Function("and", filters)

        return Function(
            function=SNQL_AGGREGATES[function.function],
            parameters=[COLUMN_VALUE, parameter],
        )

    def _collect_aggregate(self, expression: Expression) -> List[Function]:
        if isinstance(expression, Column):
            if not expression.name.isnumeric():
                raise InvalidMetricsQuery("Metric name must be a resolved index")
            return [Function("equals", [COLUMN_METRIC_ID, expression.name])]

        if isinstance(expression, Function) and expression.function == FILTER:
            if not expression.parameters:
                raise InvalidMetricsQuery("Missing filter parameters")

            (inner, *conditions) = expression.parameters
            filters = self._collect_aggregate(inner)

            for condition in conditions:
                if condition.op not in CONDITION_TO_FUNCTION:
                    raise InvalidMetricsQuery(f"Unsupported filter condition {condition.op}")

                lhs = self._convert_tag_key(condition.lhs)
                rhs = self._convert_condition_value(condition.op, condition.rhs)
                filters.append(Function(CONDITION_TO_FUNCTION[condition.op], [lhs, rhs]))

            return filters

        raise InvalidMetricsQuery("Unexpected expression in aggregate")

    def _convert_condition(self, condition: Condition) -> Condition:
        """
        Convert a filter function to a SnQL condition.
        """

        # Conditions have a rigid structure at this moment. LHS must be a column,
        # operator must be a comparison operator, and RHS must be a scalar.

        lhs = self._convert_tag_key(condition.lhs)
        rhs = self._convert_condition_value(condition.op, condition.rhs)
        return Condition(lhs=lhs, op=condition.op, rhs=rhs)

    def _convert_tag_key(self, column: Any) -> str:
        if not isinstance(column, Column):
            raise InvalidMetricsQuery("LHS of filter condition must be a column")
        if not column.name.isnumeric():
            raise InvalidMetricsQuery("LHS of filter condition must be a resolved index")

        return Column(name=f"tags_raw[{column.name}]")

    def _convert_condition_value(self, op: Op, value: Any) -> Union[str, int]:
        if op in (Op.EQ, Op.NEQ, Op.LIKE, Op.NOT_LIKE):
            return self._convert_primitive(value)

        if op in (Op.IN, Op.NOT_IN):
            if not isinstance(value, (list, tuple)):
                raise InvalidMetricsQuery("RHS of IN condition must be a list or tuple")
            return [self._convert_primitive(value) for value in value]

        raise InvalidMetricsQuery(f"Unsupported filter condition {op}")

    def _convert_primitive(self, value: Any) -> Union[str, int]:
        # TODO: Use-case aware check of value type
        if isinstance(value, (str, int)):
            return value

        if isinstance(value, Column):
            if self._is_variable(value):
                raise InvalidMetricsQuery(f"Unbound variable {value.name}")

        raise InvalidMetricsQuery("Filters must compare with a scalar value")

    def _is_variable(self, column: Column) -> bool:
        return column.name.startswith("$")


def get_entity(query: SeriesQuery) -> Entity:
    """
    Get the single use case referenced by a query. Raises a ``ValueError`` if
    the query references multiple use cases.
    """

    use_case = get_use_case(query)
    entities = EntityExtractor(_is_legacy_use_case(use_case)).visit(query)
    if len(entities) != 1:
        raise ValueError("Snuba query must reference a single entity")

    return entities.pop()


class EntityExtractor(QueryVisitor[Set[Entity]]):
    """
    Extracts all use cases referenced by MRIs in a query.
    """

    def __init__(self, legacy: bool):
        self.legacy = legacy

    def _visit_query(self, query: SeriesQuery) -> Set[Entity]:
        entities = set()
        for expression in query.expressions:
            entities |= self.visit(expression)
        return entities

    def _visit_filter(self, filt: Function) -> Set[Entity]:
        if len(filt.parameters) > 0:
            return self.visit(filt.parameters[0])
        else:
            return set()

    def _visit_condition(self, condition: Condition) -> Set[Entity]:
        return set()

    def _visit_function(self, function: Function) -> Set[Entity]:
        entities = set()
        for parameter in function.parameters:
            entities |= self.visit(parameter)
        return entities

    def _visit_column(self, column: Column) -> Set[Entity]:
        mri = parse_mri(column.name)
        if mri is None:
            raise InvalidMetricsQuery(f"Expected MRI, got `{column.name}`")

        if self.legacy:
            entity = LEGACY_TYPE_TO_ENTITY.get(mri.entity)
        else:
            entity = TYPE_TO_ENTITY.get(mri.entity)

        if entity is None:
            raise InvalidMetricsQuery(f"Unknown metric type: `{mri.entity}`")

        return entity

    def _visit_str(self, string: str) -> Set[Entity]:
        return set()

    def _visit_int(self, value: int) -> Set[Entity]:
        return set()

    def _visit_float(self, value: float) -> Set[Entity]:
        return set()
