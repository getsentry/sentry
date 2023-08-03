import math
from dataclasses import replace
from datetime import datetime
from typing import Any, Dict, FrozenSet, List, Mapping, Optional, Sequence, Set, Tuple, Type, Union

from snuba_sdk import AliasedExpression, Column, Condition, Entity, Function, Op
from snuba_sdk import Query as SnubaQuery
from snuba_sdk import Request as SnubaRequest
from snuba_sdk.query import SelectableExpression

from sentry.sentry_metrics.use_case_id_registry import QueryConfig, get_query_config
from sentry.utils.snuba import bulk_snql_query

from ..timeframe import resolve_granularity
from ..transform import Primitive, QueryVisitor
from ..types import (
    AggregationFn,
    ArithmeticFn,
    ConditionFn,
    Expression,
    Filter,
    InvalidMetricsQuery,
    MetricName,
    SeriesQuery,
    SeriesResult,
    Tag,
    Variable,
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
COLUMN_TIMESTAMP = Column("timestamp")
COLUMN_VALUE = Column("value")
COLUMN_METRIC_ID = Column("metric_id")
TIMESTAMP_ALIAS = "__bucketed_time"

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

    def bulk_execute(self, requests: List[SnubaRequest]) -> List[SeriesResult]:
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

        # Global filters are applied to every aggregate in _convert_aggregate.
        self.global_filters = [self._convert_condition(c) for c in self.query.filters]

        snuba_query = SnubaQuery(
            match=self._resolve_entity(),
            select=self._build_select(),
            groupby=self._build_groupby(),
            where=self._build_where(),
            granularity=resolve_granularity(self.query),
        )

        return SnubaRequest(
            dataset=self.config.dataset.value,
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

        return entities.pop()

    def _build_select(self) -> Sequence[SelectableExpression]:
        select = []
        for i, e in enumerate(self.query.expressions):
            function = self._convert_expression(e)
            assert isinstance(function, Function), "must select function"
            select.append(replace(function, alias=f"__expr_{i + 1}"))

        return select

    def _convert_expression(self, node: Expression) -> SelectableExpression:
        if isinstance(node, Function):
            return self._convert_function(node)
        elif isinstance(node, (str, int, float)):
            return node
        else:
            raise InvalidMetricsQuery(f"Expected selectable expression, received {type(node)}")

    def _convert_function(self, function: Function) -> SelectableExpression:
        if function.function in ArithmeticFn:
            parameters = [self._convert_expression(p) for p in function.parameters]
            return Function(function.function, parameters)

        if function.function in AggregationFn:
            return self._convert_aggregate(function)

        # Query transforms should previously have pushed filters inside
        # aggregate calls. If this hasn't happened, there's likely a bug in the
        # execution pipeline. All other functions are illegal here.
        raise InvalidMetricsQuery(f"Unexpected function {function.function}")

    def _convert_aggregate(self, function: Function) -> SelectableExpression:
        if len(function.parameters) != 1:
            raise InvalidMetricsQuery("Aggregate functions must have exactly one parameter")

        (metric_type, filters) = self._collect_aggregate(function.parameters[0])
        aggregate = self._map_aggregation_fn(metric_type, AggregationFn(function.function))
        parameter = filters[0] if len(filters) == 1 else Function("and", filters)
        return Function(aggregate, [COLUMN_VALUE, parameter])

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

        if isinstance(node, MetricName):
            if not node.key.isnumeric():
                raise InvalidMetricsQuery("Metric name must be a resolved index")
            mri = parse_mri(node.name)
            filters = self.global_filters + [Function("equals", [COLUMN_METRIC_ID, node.key])]
            return (mri.entity, filters)

        if isinstance(node, Filter):
            if not node.parameters:
                raise InvalidMetricsQuery("Missing filter parameters")

            (inner, *filters) = node.parameters
            (metric_type, conditions) = self._collect_aggregate(inner)

            for filt in filters:
                conditions.append(self._convert_condition(filt))

            return (metric_type, conditions)

        raise InvalidMetricsQuery("Unexpected expression in aggregate")

    def _build_where(self) -> Sequence[Condition]:
        return [
            Condition(COLUMN_ORG_ID, Op.EQ, self.query.scope.org_id),
            Condition(COLUMN_PROJECT_ID, Op.IN, self.query.scope.project_ids),
            Condition(COLUMN_TIMESTAMP, Op.GTE, self.query.range.start),
            Condition(COLUMN_TIMESTAMP, Op.LT, self.query.range.end),
        ]

    def _convert_tag_key(self, tag: Any) -> str:
        if not isinstance(tag, Tag):
            raise InvalidMetricsQuery("LHS of filter condition must be a column")

        if tag.name == "project":
            return COLUMN_PROJECT_ID
        if not tag.key.isnumeric():
            raise InvalidMetricsQuery("Tag key must be a resolved index")

        subscriptable = "tags" if self.config.index_values else "tags_raw"
        return Column(name=f"{subscriptable}[{tag.key}]")

    def _convert_condition(self, condition: Function) -> Function:
        op = ConditionFn(condition.function)
        lhs = self._convert_tag_key(condition.parameters[0])
        rhs = self._convert_condition_value(op, condition.parameters[1])
        return Function(op.value, [lhs, rhs])

    def _convert_condition_value(self, op: ConditionFn, value: Any) -> Union[str, int, List]:
        value_type = op.value_type

        if value_type == "scalar":
            return self._convert_primitive(value)
        elif value_type == "tuple":
            if not isinstance(value, (list, tuple)):
                raise InvalidMetricsQuery("RHS of IN condition must be a list or tuple")
            return [self._convert_primitive(value) for value in value]
        else:
            raise InvalidMetricsQuery(f"Unsupported filter condition {op}")

    def _convert_primitive(self, value: Any) -> Union[str, int]:
        tag_type: Type = str
        if self.config.index_values:
            tag_type = int

        if not isinstance(value, tag_type):
            raise InvalidMetricsQuery("Filters must compare with a scalar value")

        return value

    def _build_groupby(self):
        if self.query.rollup.interval is None or self.query.rollup.totals:
            raise NotImplementedError("Totals queries are not yet supported")

        groupby = [AliasedExpression(self._convert_tag_key(c), c.name) for c in self.query.groups]
        groupby.append(self._build_timestamp_group())
        return groupby

    def _build_timestamp_group(self) -> Function:
        return Function(
            "toStartOfInterval",
            [
                COLUMN_TIMESTAMP,
                Function("toIntervalSecond", [self.query.rollup.interval]),
                "Universal",
            ],
            TIMESTAMP_ALIAS,
        )


TagDict = Dict[str, str]
GroupKey = FrozenSet[Tuple[str, str]]
SeriesDict = Dict[int, Dict[datetime, float]]


class SnubaResultConverter:
    def __init__(self, snuba_result: SnubaResult):
        self.snuba_result = snuba_result
        self.intervals: Set[datetime] = set()
        self.tags: Dict[str, Set[str]] = {}
        self.buckets: Dict[GroupKey, SeriesDict] = {}

    def _parse_expression_id(self, key: str) -> Optional[int]:
        if key.startswith("__expr_"):
            return int(key[7:])
        return None

    def _record_bucket(self, bucket_time: datetime, tags: TagDict, values: Dict[int, float]):
        series = self.buckets.setdefault(frozenset(tags.items()), {})
        for expr_id, value in values.items():
            series.setdefault(expr_id, {})[bucket_time] = value

    def _record_entry(self, entry: Dict[str, Any]):
        timestamp: str = entry.pop(TIMESTAMP_ALIAS)
        bucket_time = datetime.fromisoformat(timestamp)
        self.intervals.add(bucket_time)

        values: Dict[int, float] = {}
        tags: TagDict = {}

        for k, v in entry.items():
            if expr_id := self._parse_expression_id(k):
                if not math.isnan(v):
                    values[expr_id - 1] = float(v)
            else:
                self.tags.setdefault(k, set()).add(str(v))
                tags[k] = str(v)

        self._record_bucket(bucket_time, tags, values)

    def convert(self) -> SeriesResult:
        for entry in self.snuba_result["data"]:
            self._record_entry(entry)

        return SeriesResult(
            tags={str(k): list(v) for k, v in self.tags.items()},
            intervals=sorted(self.intervals),
            groups=self.buckets,
        )


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

    def _visit_aggregation(self, aggregation: Function) -> Set[Entity]:
        return self._visit_function(aggregation)

    def _visit_arithmetic(self, arithmetic: Function) -> Set[Entity]:
        return self._visit_function(arithmetic)

    def _visit_filter(self, filt: Filter) -> Set[Entity]:
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

    def _visit_metric(self, metric: MetricName) -> Set[Entity]:
        mri = parse_mri(metric.name)
        return {self.config.entity(mri.entity)}

    def _visit_tag(self, tag: Tag) -> Set[Entity]:
        return set()

    def _visit_variable(self, variable: Variable) -> Set[Entity]:
        return set()

    def _visit_literal(self, value: Primitive) -> Set[Entity]:
        return set()
