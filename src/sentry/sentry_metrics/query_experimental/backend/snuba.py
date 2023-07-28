from typing import Any, List, Mapping, Sequence, Set, Tuple, Type, Union

from snuba_sdk import Column, Condition, Entity, Function, Op
from snuba_sdk import Query as SnubaQuery
from snuba_sdk import Request as SnubaRequest
from snuba_sdk.query import SelectableExpression

from sentry.sentry_metrics.use_case_id_registry import QueryConfig, get_query_config
from sentry.utils.snuba import bulk_snql_query

from ..timeframe import resolve_granularity
from ..transform import QueryVisitor
from ..types import (
    FILTER,
    AggregationFn,
    ArithmeticFn,
    Expression,
    InvalidMetricsQuery,
    SeriesQuery,
    SeriesResult,
    parse_mri,
)
from ..use_case import get_use_case
from .base import MetricsBackend

# General snuba configuration
APP_ID = "sentry_metrics"
REFERRER = "sentry_metrics.query"

# Snuba column names
COLUMN_PROJECT_ID = Column("project_id")
COLUMN_ORG_ID = Column("org_id")
COLUMN_TIMESTAMP_FILTER = Column("timestamp")  # Used in filters
COLUMN_TIMESTAMP_GROUP = Column("bucketed_time")  # Used in groupby
COLUMN_VALUE = Column("value")
COLUMN_METRIC_ID = Column("metric_id")

# Functions and operators.
#
# Note that all functions are conditional since there's at least one filter on
# the metric ID. Additional tag filters are applied as needed. Functions are
# grouped by metric type obtained from ``parse_mri``.
SNQL_AGGREGATES: Mapping[str, Mapping[AggregationFn, str]] = {
    "c": {
        AggregationFn.SUM: "sumIf",
    },
    "d": {
        AggregationFn.COUNT: "countIf",
        AggregationFn.AVG: "avgIf",
        AggregationFn.MAX: "maxIf",
        AggregationFn.MIN: "minIf",
        AggregationFn.P50: "quantilesIf(0.5)",
        AggregationFn.P75: "quantilesIf(0.75)",
        AggregationFn.P95: "quantilesIf(0.95)",
        AggregationFn.P99: "quantilesIf(0.99)",
    },
    "s": {
        AggregationFn.COUNT_UNIQUE: "uniqIf",
    },
}
CONDITION_TO_FUNCTION = {
    Op.EQ: "equals",
    Op.NEQ: "notEquals",
    Op.LIKE: "like",
    Op.NOT_LIKE: "notLike",
    Op.IN: "in",
    Op.NOT_IN: "notIn",
}

# Additional helper typing
SnubaResult = Mapping[str, Any]


class SnubaMetricsBackend(MetricsBackend[SnubaRequest]):
    """
    Metrics backend that uses Snuba datasets as a data source.

    The dataset and entities used by this backend are determined by the
    ``QueryConfig`` of the use case specified through metrics in the query.
    """

    def __init__(self, use_cache: bool = False):
        self.use_cache = use_cache

    def create_request(self, query: SeriesQuery) -> SnubaRequest:
        """
        Generate a SnQL query from a metric series query.
        """
        return SnubaQueryConverter(query).build()

    def execute(self, query: SnubaRequest) -> SeriesResult:
        """
        Convert and run a series query against Snuba.
        """
        return self.bulk_execute([query])[0]

    def bulk_execute(self, requests) -> List[SeriesResult]:
        """
        Convert and run a series of queries against Snuba.
        """
        snuba_results = bulk_snql_query(
            requests,
            use_cache=self.use_cache,
            referrer=REFERRER,
        )

        return [self._convert_result(result) for result in snuba_results]

    def _convert_result(self, snuba_result: SnubaResult) -> SeriesResult:
        """
        Convert a Snuba result to a series result.
        """
        return SnubaResultConverter(snuba_result).convert()


class SnubaQueryConverter:
    def __init__(self, query: SeriesQuery):
        self.query = query
        self.use_case = get_use_case(query)
        self.config = get_query_config(self.use_case)

    def build(self) -> SnubaRequest:
        """
        Generate a Snuba request from a metric series query.
        """

        snuba_query = SnubaQuery(
            match=self._resolve_entity(),
            select=self._build_select(),
            groupby=self._build_groupby(),
            where=self._build_where(),
            granularity=resolve_granularity(self.query),
        )

        return SnubaRequest(
            dataset=self.config.dataset,
            app_id=APP_ID,
            query=snuba_query,
            tenant_ids={"organization_id": self.query.scope.org_id},
        )

    def _resolve_entity(self) -> Entity:
        """
        Get the single use case referenced by a query. Raises a ``ValueError``
        if the query references multiple use cases.
        """

        entities = EntityExtractor(self.config).visit(self.query)
        if len(entities) != 1:
            raise ValueError("Snuba query must reference a single entity")

        return entities.pop().value

    def _build_select(self) -> Sequence[SelectableExpression]:
        return [self._convert_expression(e) for e in self.query.expressions]

    def _convert_expression(self, node: Expression) -> SelectableExpression:
        if isinstance(node, Function):
            return self._convert_function(node)
        elif isinstance(node, (str, int, float)):
            return node
        else:
            raise InvalidMetricsQuery(f"Expected selectable expression, received {type(node)}")

    def _convert_function(self, function: Function) -> SelectableExpression:
        if function.function in ArithmeticFn:
            return Function(
                function=function.function,
                parameters=[self._convert_expression(p) for p in function.parameters],
            )

        if function.function in AggregationFn:
            return self._convert_aggregate(function)

        if function.function == FILTER:
            # Query transforms should previously have pushed filters inside
            # aggregate calls. If this hasn't happened, there's likely a bug in
            # the execution pipeline.
            raise ValueError("Unexpected filter function in SnQL generation")

        raise InvalidMetricsQuery(f"Unknown function {function.function}")

    def _convert_aggregate(self, function: Function) -> SelectableExpression:
        if len(function.parameters) != 1:
            raise InvalidMetricsQuery("Aggregate functions must have exactly one parameter")

        (metric_type, filters) = self._collect_aggregate(function.parameters[0])
        aggregate = self._map_aggregation_fn(metric_type, AggregationFn(function.function))
        parameter = filters[0] if len(filters) == 1 else Function("and", filters)

        return Function(
            function=aggregate,
            parameters=[COLUMN_VALUE, parameter],
        )

    def _map_aggregation_fn(self, metric_type: str, function: AggregationFn) -> str:
        if metric_type not in SNQL_AGGREGATES:
            raise InvalidMetricsQuery(f"Unsupported metric type {metric_type}")

        if function not in SNQL_AGGREGATES[metric_type]:
            raise InvalidMetricsQuery(f"Unsupported function {function} on {metric_type}")

        return SNQL_AGGREGATES[metric_type][function]

    def _collect_aggregate(self, node: Expression) -> Tuple[str, List[Function]]:
        """
        Collects the metric type and all recursively applied filters that need
        to be applied to the metric to compute an aggregate.
        """

        if isinstance(node, Column):
            if not node.key.isnumeric():
                raise InvalidMetricsQuery("Metric name must be a resolved index")
            mri = parse_mri(node.name)
            return (mri.entity, [Function("equals", [COLUMN_METRIC_ID, node.key])])

        if isinstance(node, Function) and node.function == FILTER:
            if not node.parameters:
                raise InvalidMetricsQuery("Missing filter parameters")

            (inner, *filters) = node.parameters
            (metric_type, conditions) = self._collect_aggregate(inner)

            for filt in filters:
                if filt.op not in CONDITION_TO_FUNCTION:
                    raise InvalidMetricsQuery(f"Unsupported filter condition {filt.op}")

                lhs = self._convert_tag_key(filt.lhs)
                rhs = self._convert_condition_value(filt.op, filt.rhs)
                conditions.append(Function(CONDITION_TO_FUNCTION[filt.op], [lhs, rhs]))

            return (metric_type, conditions)

        raise InvalidMetricsQuery("Unexpected expression in aggregate")

    def _build_where(self) -> Sequence[Condition]:
        where = [
            Condition(COLUMN_ORG_ID, Op.EQ, self.query.scope.org_id),
            Condition(COLUMN_TIMESTAMP_FILTER, Op.GTE, self.query.start),
            Condition(COLUMN_TIMESTAMP_FILTER, Op.LT, self.query.end),
        ]

        if self.query.scope.project_ids:
            where.append(Condition(COLUMN_PROJECT_ID, Op.IN, self.query.scope.project_ids))

        for filt in self.query.filters:
            where.append(self._convert_condition(filt))

        return where

    def _convert_condition(self, condition: Condition) -> Condition:
        # Conditions have a rigid structure at this moment. LHS must be a column,
        # operator must be a comparison operator, and RHS must be a scalar.

        lhs = self._convert_tag_key(condition.lhs)
        rhs = self._convert_condition_value(condition.op, condition.rhs)
        return Condition(lhs=lhs, op=condition.op, rhs=rhs)

    def _convert_tag_key(self, column: Any) -> str:
        if not isinstance(column, Column):
            raise InvalidMetricsQuery("LHS of filter condition must be a column")

        if column.name == "project":
            return COLUMN_PROJECT_ID
        if not column.key.isnumeric():
            raise InvalidMetricsQuery("Tag key must be a resolved index")
        return Column(name=f"tags_raw[{column.key}]")

    def _convert_condition_value(self, op: Op, value: Any) -> Union[str, int, List]:
        if op in (Op.EQ, Op.NEQ, Op.LIKE, Op.NOT_LIKE):
            return self._convert_primitive(value)

        if op in (Op.IN, Op.NOT_IN):
            if not isinstance(value, (list, tuple)):
                raise InvalidMetricsQuery("RHS of IN condition must be a list or tuple")
            return [self._convert_primitive(value) for value in value]

        raise InvalidMetricsQuery(f"Unsupported filter condition {op}")

    def _convert_primitive(self, value: Any) -> Union[str, int]:
        tag_type: Type = str
        if self.config.index_values:
            tag_type = int

        if not isinstance(value, tag_type):
            raise InvalidMetricsQuery("Filters must compare with a scalar value")

        return value

    def _build_groupby(self):
        groupby = [self._convert_tag_key(c) for c in self.query.groups]
        groupby.append(COLUMN_TIMESTAMP_GROUP)
        return groupby


class SnubaResultConverter:
    def __init__(self, snuba_result: SnubaResult):
        self.snuba_result = snuba_result

    def convert(self) -> SeriesResult:
        from pprint import pprint

        pprint(self.snuba_result)
        # TODO: Get necessary subset of SnubaResultConverter
        raise NotImplementedError()


class EntityExtractor(QueryVisitor[Set[Entity]]):
    """
    Extracts all use cases referenced by MRIs in a query.
    """

    def __init__(self, config: QueryConfig):
        self.config = config

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
        return {self.config.entity(mri.entity)}

    def _visit_str(self, string: str) -> Set[Entity]:
        return set()

    def _visit_int(self, value: int) -> Set[Entity]:
        return set()

    def _visit_float(self, value: float) -> Set[Entity]:
        return set()
