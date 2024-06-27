from __future__ import annotations

import copy
import inspect
from abc import ABC, abstractmethod
from collections.abc import Callable, Collection, Iterable, Mapping, MutableMapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, Deque, Optional, Union

from django.db.models import QuerySet
from snuba_sdk import Column, Condition, Entity, Function, Granularity, Op, Query, Request
from snuba_sdk.orderby import Direction, OrderBy

from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.fields.derived_common import (
    get_derived_aliases,
    get_derived_metrics,
    get_derived_ops,
)
from sentry.snuba.metrics.fields.histogram import ClickhouseHistogram
from sentry.snuba.metrics.naming_layer.mapping import get_public_name_from_mri
from sentry.snuba.metrics.naming_layer.mri import SessionMRI, TransactionMRI
from sentry.snuba.metrics.utils import (
    DEFAULT_AGGREGATES,
    GENERIC_OP_TO_SNUBA_FUNCTION,
    GRANULARITY,
    OP_TO_SNUBA_FUNCTION,
    OPERATIONS_PERCENTILES,
    UNIT_TO_TYPE,
    DerivedMetricParseException,
    MetricDoesNotExistException,
    MetricEntity,
    MetricOperationType,
    MetricType,
    NotSupportedOverCompositeEntityException,
    OrderByNotSupportedOverCompositeEntityException,
    combine_dictionary_of_list_values,
    get_timestamp_column_name,
)
from sentry.utils.snuba import raw_snql_query

__all__ = (
    "metric_object_factory",
    "run_metrics_query",
    "MetricExpression",
    "MetricExpressionBase",
    "DerivedMetricExpression",
    "SingularEntityDerivedMetric",
    "generate_bottom_up_dependency_tree_for_metrics",
    "org_id_from_projects",
    "COMPOSITE_ENTITY_CONSTITUENT_ALIAS",
)

COMPOSITE_ENTITY_CONSTITUENT_ALIAS = "__CHILD_OF__"

SnubaDataType = dict[str, Any]
PostQueryFuncReturnType = Optional[Union[tuple[Any, ...], ClickhouseHistogram, int, float]]
MetricOperationParams = Mapping[str, Union[str, int, float]]


def build_metrics_query(
    *,
    entity_key: EntityKey,
    select: list[Column],
    where: list[Condition],
    groupby: list[Column],
    project_ids: Sequence[int],
    org_id: int,
    use_case_id: UseCaseID,
    start: datetime | None = None,
    end: datetime | None = None,
) -> Request:
    if end is None:
        end = datetime.now()
    if start is None:
        start = end - timedelta(hours=24)

    end = end.replace(second=0, microsecond=0)
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)

    query = Query(
        match=Entity(entity_key.value),
        select=select,
        groupby=groupby,
        where=[
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column(get_timestamp_column_name()), Op.GTE, start),
            Condition(Column(get_timestamp_column_name()), Op.LT, end),
        ]
        + where,
        granularity=Granularity(GRANULARITY),
    )

    request = Request(
        dataset=(
            Dataset.Metrics.value
            if use_case_id == UseCaseID.SESSIONS
            else Dataset.PerformanceMetrics.value
        ),
        app_id="metrics",
        query=query,
        tenant_ids={"organization_id": org_id, "use_case_id": use_case_id.value},
    )

    return request


def run_metrics_query(
    *,
    entity_key: EntityKey,
    select: list[Column],
    where: list[Condition],
    groupby: list[Column],
    project_ids: Sequence[int],
    org_id: int,
    referrer: str,
    use_case_id: UseCaseID,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[SnubaDataType]:
    request = build_metrics_query(
        entity_key=entity_key,
        select=select,
        where=where,
        groupby=groupby,
        project_ids=project_ids,
        org_id=org_id,
        use_case_id=use_case_id,
        start=start,
        end=end,
    )
    result = raw_snql_query(request, referrer, use_cache=True)
    return result["data"]


def _get_known_entity_of_metric_mri(metric_mri: str) -> EntityKey | None:
    # ToDo(ogi): Reimplement this
    try:
        SessionMRI(metric_mri)
        entity_prefix = metric_mri.split(":")[0]
        return {
            "c": EntityKey.MetricsCounters,
            "d": EntityKey.MetricsDistributions,
            "s": EntityKey.MetricsSets,
        }[entity_prefix]
    except (ValueError, IndexError, KeyError):
        pass
    try:
        TransactionMRI(metric_mri)
        entity_prefix = metric_mri.split(":")[0]
        return {
            "c": EntityKey.GenericMetricsCounters,
            "d": EntityKey.GenericMetricsDistributions,
            "s": EntityKey.GenericMetricsSets,
        }[entity_prefix]
    except (ValueError, IndexError, KeyError):
        pass
    try:
        entity_prefix, namespace = metric_mri.split(":")
        if namespace.startswith("custom"):
            return {
                "c": EntityKey.GenericMetricsCounters,
                "d": EntityKey.GenericMetricsDistributions,
                "s": EntityKey.GenericMetricsSets,
                "g": EntityKey.GenericMetricsGauges,
            }[entity_prefix]
    except (ValueError, IndexError, KeyError):
        pass

    return None


def _get_entity_of_metric_mri(
    projects: QuerySet[Project] | Sequence[Project], metric_mri: str, use_case_id: UseCaseID
) -> EntityKey:
    known_entity = _get_known_entity_of_metric_mri(metric_mri)
    if known_entity is not None:
        return known_entity

    assert projects
    org_id = org_id_from_projects(projects)
    metric_id = indexer.resolve(use_case_id, org_id, metric_mri)

    if metric_id is None:
        raise InvalidParams

    entity_keys_set: frozenset[EntityKey]
    if use_case_id in [UseCaseID.TRANSACTIONS, UseCaseID.SPANS]:
        entity_keys_set = frozenset(
            {
                EntityKey.GenericMetricsCounters,
                EntityKey.GenericMetricsSets,
                EntityKey.GenericMetricsDistributions,
            }
        )
    elif use_case_id is UseCaseID.SESSIONS:
        entity_keys_set = frozenset(
            {EntityKey.MetricsCounters, EntityKey.MetricsSets, EntityKey.MetricsDistributions}
        )
    elif use_case_id is UseCaseID.ESCALATING_ISSUES:
        entity_keys_set = frozenset({EntityKey.GenericMetricsCounters})
    elif use_case_id is UseCaseID.CUSTOM:
        entity_keys_set = frozenset(
            {
                EntityKey.GenericMetricsCounters,
                EntityKey.GenericMetricsSets,
                EntityKey.GenericMetricsDistributions,
                EntityKey.GenericMetricsGauges,
            }
        )
    else:
        raise InvalidParams

    for entity_key in entity_keys_set:
        data = run_metrics_query(
            entity_key=entity_key,
            select=[Column("metric_id")],
            where=[Condition(Column("metric_id"), Op.EQ, metric_id)],
            groupby=[Column("metric_id")],
            referrer=f"snuba.metrics.meta.get_entity_of_metric.{use_case_id.value}",
            project_ids=[p.id for p in projects],
            org_id=org_id,
            use_case_id=use_case_id,
        )
        if data:
            return entity_key

    raise InvalidParams(f"Raw metric {get_public_name_from_mri(metric_mri)} does not exist")


def org_id_from_projects(projects: Sequence[Project]) -> int:
    assert len({p.organization_id for p in projects}) == 1
    return projects[0].organization_id


@dataclass
class MetricObjectDefinition:
    metric_mri: str


@dataclass
class AliasedDerivedMetricDefinition(MetricObjectDefinition):
    raw_metric_mri: str
    filters: Callable[..., Function] | None = None


class MetricObject(MetricObjectDefinition, ABC):
    """
    Represents an object that encapsulates a metric_mri or to be more accurate what's between
    the parentheses in an expression that looks like `sum(sentry.sessions.session)`

    NOTE: (nikhar) This class is used very extensively in the metrics codebase and core
    functionality. Duplicating these for metrics_v2 would be a lot of work and would require
    a lot of testing. Therefore, we are using the same class for metrics_v2 as well with
    the added use_metrics_v2 parameter in the methods that require it.
    """

    @abstractmethod
    def generate_filter_snql_conditions(
        self, org_id: int, use_case_id: UseCaseID, use_metrics_v2: bool | None
    ) -> Function:
        raise NotImplementedError

    @abstractmethod
    def generate_metric_ids(
        self, projects: Sequence[Project], use_case_id: UseCaseID, use_metrics_v2: bool | None
    ) -> set[int | str]:
        raise NotImplementedError


class RawMetric(MetricObject):
    """
    Represents a class where the metric object just encapsulates a string name identifier for a
    metric
    """

    def generate_metric_ids(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        use_metrics_v2: bool | None = None,
    ) -> set[int | str]:
        return (
            {self.metric_mri}
            if use_metrics_v2
            else {resolve_weak(use_case_id, org_id_from_projects(projects), self.metric_mri)}
        )

    def generate_filter_snql_conditions(
        self, org_id: int, use_case_id: UseCaseID, use_metrics_v2: bool | None = None
    ) -> Function:
        metric_clause = (
            [Column("metric_mri"), self.metric_mri]
            if use_metrics_v2
            else [Column("metric_id"), resolve_weak(use_case_id, org_id, self.metric_mri)]
        )
        return Function(
            "equals",
            metric_clause,
        )


class AliasedDerivedMetric(AliasedDerivedMetricDefinition, MetricObject):
    """
    Represents a class where metric object is a class that encapsulates filter logic on an alias
    for a raw metric name
    """

    def generate_metric_ids(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        use_metrics_v2: bool | None = None,
    ) -> set[int | str]:
        return (
            {self.raw_metric_mri}
            if use_metrics_v2
            else {resolve_weak(use_case_id, org_id_from_projects(projects), self.raw_metric_mri)}
        )

    def generate_filter_snql_conditions(
        self, org_id: int, use_case_id: UseCaseID, use_metrics_v2: bool | None = None
    ) -> Function:
        metric_clause = (
            [Column("metric_mri"), self.raw_metric_mri]
            if use_metrics_v2
            else [Column("metric_id"), resolve_weak(use_case_id, org_id, self.raw_metric_mri)]
        )
        conditions = [
            Function(
                "equals",
                metric_clause,
            )
        ]

        if self.filters is not None:
            for filter_ in self.filters(org_id=org_id):
                conditions.append(filter_)
        return Function("and", conditions)


@dataclass
class MetricOperationDefinition:
    op: MetricOperationType


class MetricOperation(MetricOperationDefinition, ABC):
    @abstractmethod
    def validate_can_orderby(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def validate_can_groupby(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def validate_can_filter(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def run_post_query_function(
        self,
        data: SnubaDataType,
        metric_mri: str,
        alias: str,
        idx: int | None = None,
        params: MetricOperationParams | None = None,
    ) -> SnubaDataType:
        raise NotImplementedError

    @abstractmethod
    def generate_snql_function(
        self,
        entity: MetricEntity,
        use_case_id: UseCaseID,
        alias: str,
        aggregate_filter: Function,
        org_id: int,
        params: MetricOperationParams | None = None,
    ) -> Function:
        raise NotImplementedError

    @abstractmethod
    def get_default_null_values(self) -> int | list[tuple[float]] | None:
        raise NotImplementedError

    @abstractmethod
    def get_meta_type(self) -> str | None:
        raise NotImplementedError


@dataclass
class DerivedOpDefinition(MetricOperationDefinition):
    can_orderby: bool
    can_groupby: bool = False
    can_filter: bool = False
    meta_type: str | None = None
    post_query_func: Callable[..., PostQueryFuncReturnType] = lambda data, *args: data
    snql_func: Callable[..., Function | None] = lambda _: None
    default_null_value: int | list[tuple[float]] | None = None


class RawOp(MetricOperation):
    def validate_can_orderby(self) -> None:
        return

    def validate_can_groupby(self) -> bool:
        return False

    def validate_can_filter(self) -> bool:
        return False

    def get_meta_type(self) -> str | None:
        # If we have a percentile operation then we want to convert its type from Array(float64) to Float64
        # because once we receive a percentile result from ClickHouse we automatically pop from the array the
        # first element thus the datatype itself must also be changed in the metadata.
        if self.op in OPERATIONS_PERCENTILES:
            return "Float64"

        return None

    def run_post_query_function(
        self,
        data: SnubaDataType,
        metric_mri: str,
        alias: str,
        idx: int | None = None,
        params: MetricOperationParams | None = None,
    ) -> SnubaDataType:
        return data

    def _wrap_quantiles(self, function: Function, alias: str) -> Function:
        # In case we have a percentile we want to take the first element of the array. This is done because we are
        # using quantilesIf instead of quantileIf, therefore we have an array as a result.
        if self.op in OPERATIONS_PERCENTILES:
            function = Function(
                "arrayElement",
                [
                    # We remove the alias from the function in order to avoid multiple aliases with the same name.
                    replace(function, alias=None),
                    # First element is 1 because ClickHouse arrays are indexed starting from 1.
                    1,
                ],
                alias=alias,
            )

        return function

    def _gauge_avg(self, aggregate_filter: Function, alias: str) -> Function:
        return Function(
            "divide",
            [
                Function("sumIf", [Column("value"), aggregate_filter]),
                Function("countIf", [Column("value"), aggregate_filter]),
            ],
            alias=alias,
        )

    def generate_snql_function(
        self,
        entity: MetricEntity,
        use_case_id: UseCaseID,
        alias: str,
        aggregate_filter: Function,
        org_id: int,
        params: MetricOperationParams | None = None,
    ) -> Function:
        if use_case_id in [
            UseCaseID.TRANSACTIONS,
            UseCaseID.SPANS,
            UseCaseID.CUSTOM,
            UseCaseID.ESCALATING_ISSUES,
        ]:
            snuba_function = GENERIC_OP_TO_SNUBA_FUNCTION[entity][self.op]
        else:
            snuba_function = OP_TO_SNUBA_FUNCTION[entity][self.op]

        # The average of a gauge is a special case of operation that is derived of two sub-operations
        # , and it could have been implemented with `DerivedOp` but in order to disambiguate between `avg` of
        # a gauge or `avg` of a distribution, significant code changes would have to be done, since metric
        # factory is used all over the code and lacks the entity parameter that would make the dataset inference
        # simpler.
        if entity == "generic_metrics_gauges" and self.op == "avg":
            function = self._gauge_avg(aggregate_filter, alias)
        else:
            function = Function(snuba_function, [Column("value"), aggregate_filter], alias=alias)

        return self._wrap_quantiles(function, alias)

    def get_default_null_values(self) -> int | list[tuple[float]] | None:
        return copy.copy(DEFAULT_AGGREGATES[self.op])


class DerivedOp(DerivedOpDefinition, MetricOperation):
    def validate_can_orderby(self) -> None:
        if not self.can_orderby:
            raise DerivedMetricParseException(
                f"Operation {self.op} cannot be used to order a query"
            )

    def validate_can_groupby(self) -> bool:
        return self.can_groupby

    def validate_can_filter(self) -> bool:
        return self.can_filter

    def get_meta_type(self) -> str | None:
        return self.meta_type

    def run_post_query_function(
        self,
        data: SnubaDataType,
        metric_mri: str,
        alias: str,
        idx: int | None = None,
        params: MetricOperationParams | None = None,
    ) -> SnubaDataType:
        if idx is None:
            subdata = data[alias]
        else:
            subdata = data[alias][idx]

        # Fetch the function args
        metrics_query_args = inspect.signature(self.post_query_func).parameters.keys()

        compute_func_dict = {}
        # ToDo(ahmed): Add support for other fields that might be required as function arguments in the future. For now,
        #  the only default required argument is data as post query function relies on it to manipulate the data
        #  returned from the query
        if "data" in metrics_query_args:
            compute_func_dict["data"] = subdata

        if metrics_query_args and params is not None:
            for field in metrics_query_args:
                try:
                    # Adding this try/except because we do not want to override the defaults of the function with None
                    compute_func_dict[field] = params[field]
                except KeyError:
                    continue

        # ToDo(ahmed): Add try/catch here in case of some missing required arguments for a better error message
        subdata = self.post_query_func(**compute_func_dict)

        if idx is None:
            data[alias] = subdata
        else:
            data[alias][idx] = subdata
        return data

    def generate_snql_function(
        self,
        entity: MetricEntity,
        use_case_id: UseCaseID,
        alias: str,
        aggregate_filter: Function,
        org_id: int,
        params: MetricOperationParams | None = None,
    ) -> Function:
        metrics_query_args = inspect.signature(self.snql_func).parameters.keys()
        kwargs: MutableMapping[str, float | int | str | UseCaseID | Function] = {}

        if "alias" in metrics_query_args:
            kwargs["alias"] = alias
        if "aggregate_filter" in metrics_query_args:
            kwargs["aggregate_filter"] = aggregate_filter
        if "org_id" in metrics_query_args:
            kwargs["org_id"] = org_id
        if "use_case_id" in metrics_query_args:
            kwargs["use_case_id"] = use_case_id

        if metrics_query_args and params is not None:
            for field in metrics_query_args:
                try:
                    # Adding this try/except because we do not want to override the defaults of the function with None
                    kwargs[field] = params[field]
                except KeyError:
                    continue
        try:
            return self.snql_func(**kwargs)
        except TypeError as e:
            raise InvalidParams(e)

    def get_default_null_values(self) -> int | list[tuple[float]] | None:
        return self.default_null_value


class MetricExpressionBase(ABC):
    @abstractmethod
    def validate_can_orderby(self) -> None:
        """
        Validate that the expression can be used to order a query
        """
        raise NotImplementedError

    @abstractmethod
    def get_entity(
        self, projects: QuerySet[Project] | Sequence[Project], use_case_id: UseCaseID
    ) -> MetricEntity | dict[MetricEntity, Sequence[str]]:
        """
        Method that generates the entity of an instance of MetricsFieldBase.
        `entity` property will always be None for instances of DerivedMetric that rely on
        constituent metrics that span multiple entities.
        """
        raise NotImplementedError

    @abstractmethod
    def generate_metric_ids(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        use_metrics_v2: bool | None = None,
    ) -> set[int]:
        """
        Method that generates all the metric ids required to query an instance of
        MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_select_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        """
        Method that generates a list of SnQL functions required to query an instance of
        MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_orderby_clause(
        self,
        direction: Direction,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[OrderBy]:
        """
        Method that generates a list of SnQL OrderBy clauses based on an instance of
        MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_default_null_values(self) -> int | list[tuple[float]] | None:
        """
        Method that generates the appropriate default value for an instance of MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_available_operations(self) -> Collection[MetricOperation]:
        """
        Method that generate the available operations for an instance of DerivedMetric
        """
        raise NotImplementedError

    @abstractmethod
    def run_post_query_function(
        self,
        data: SnubaDataType,
        alias: str,
        params: MetricOperationParams | None = None,
        idx: int | None = None,
    ) -> Any:
        """
        Method that runs functions on the values returned from the query
        """
        raise NotImplementedError

    @abstractmethod
    def generate_bottom_up_derived_metrics_dependencies(
        self, alias: str
    ) -> Iterable[tuple[MetricOperation | None, str, str]]:
        """
        Function that builds a metrics dependency list from a derived metric_tree
        As an example, let's consider the `session.errored` derived metric

            session.errored
               /   \
              /    session.errored_preaggregated
             /
        session.errored_set

        This function would generate a bottom up dependency list that would look something like
        this ["session.errored_set", "session.errored_preaggregated", "session.errored"]

        This is necessary especially for instances of `CompositeEntityDerivedMetric` because these
        do not have a direct mapping to a query alias but are rather computed post query, and so to
        calculate the value of that field we would need to guarantee that the values of its
        constituent metrics are computed first.

        This is more apparent when the dependency tree contains multiple levels of instances of
        `CompositeEntityDerivedMetric`. Following up with our example,

        session.errored
               /   \
              /    composite_entity_derived_metric
             /       \
            /        session.errored_preaggregated
           /
        session.errored_set

        In this modified example, our dependency list would change to
        [
        "session.errored_set", "session.errored_preaggregated",
        "composite_entity_derived_metric", "session.errored"
        ]
        And this order is necessary because we would loop over this list to compute
        `composite_entity_derived_metric` first which does not have a direct mapping to a query
        alias before we are able to compute `session.errored` which also does not have a direct
        query alias
        """
        raise NotImplementedError

    @abstractmethod
    def generate_groupby_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        """
        Method that generates a list of SnQL groupby statements based on whether an instance of MetricsFieldBase
        supports it
        """
        raise NotImplementedError

    @abstractmethod
    def generate_where_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        """
        Method that generates a list of SnQL where statements based on whether an instance of MetricsFieldBase
        supports it
        """
        raise NotImplementedError

    @abstractmethod
    def get_meta_type(self) -> str | None:
        """
        Method that returns the snuba meta type of an instance of MetricsFieldBase
        """
        raise NotImplementedError


@dataclass
class MetricExpressionDefinition:
    metric_operation: MetricOperation
    metric_object: MetricObject


class MetricExpression(MetricExpressionDefinition, MetricExpressionBase):
    """
    This class serves the purpose of representing any aggregate, raw metric combination for
    example `sum(sentry.sessions.session)`. It is created on the fly to abstract the field
    conversions to SnQL away from the query builder.
    """

    def __str__(self) -> str:
        return f"{self.metric_operation.op}({self.metric_object.metric_mri})"

    def validate_can_orderby(self) -> None:
        self.metric_operation.validate_can_orderby()

    def get_entity(
        self, projects: QuerySet[Project] | Sequence[Project], use_case_id: UseCaseID
    ) -> MetricEntity:
        return _get_entity_of_metric_mri(projects, self.metric_object.metric_mri, use_case_id).value

    def generate_select_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
        use_metrics_v2: bool | None = None,
    ) -> list[Function]:
        org_id = org_id_from_projects(projects)
        return [
            self.build_conditional_aggregate_for_metric(
                org_id,
                entity=self.get_entity(projects, use_case_id),
                use_case_id=use_case_id,
                alias=alias,
                params=params,
                use_metrics_v2=use_metrics_v2,
            )
        ]

    def generate_orderby_clause(
        self,
        direction: Direction,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[OrderBy]:
        self.metric_operation.validate_can_orderby()
        return [
            OrderBy(
                self.generate_select_statements(
                    projects, params=params, use_case_id=use_case_id, alias=alias
                )[0],
                direction,
            )
        ]

    def generate_available_operations(self) -> Collection[MetricOperationType]:
        return []

    def generate_default_null_values(self) -> int | list[tuple[float]] | None:
        return self.metric_operation.get_default_null_values()

    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> set[int]:
        return self.metric_object.generate_metric_ids(projects, use_case_id)

    def run_post_query_function(
        self,
        data: SnubaDataType,
        alias: str,
        params: MetricOperationParams | None = None,
        idx: int | None = None,
    ) -> Any:
        data = self.metric_operation.run_post_query_function(
            data,
            self.metric_object.metric_mri,
            alias=alias,
            params=params,
            idx=idx,
        )
        return data[alias][idx] if idx is not None else data[alias]

    def generate_bottom_up_derived_metrics_dependencies(
        self, alias: str
    ) -> Iterable[tuple[MetricOperationType, str, str]]:
        return [(self.metric_operation.op, self.metric_object.metric_mri, alias)]

    def build_conditional_aggregate_for_metric(
        self,
        org_id: int,
        entity: MetricEntity,
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
        use_metrics_v2: bool | None = None,
    ) -> Function:
        # We don't pass params to the metric object because params are usually applied on the operation not on the
        # metric object/name
        conditions = self.metric_object.generate_filter_snql_conditions(
            org_id=org_id, use_case_id=use_case_id, use_metrics_v2=use_metrics_v2
        )

        return self.metric_operation.generate_snql_function(
            alias=alias,
            aggregate_filter=conditions,
            use_case_id=use_case_id,
            entity=entity,
            params=params,
            org_id=org_id,
        )

    def generate_groupby_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        if not self.metric_operation.validate_can_groupby():
            raise InvalidParams(
                f"Cannot group by metrics expression {self.metric_operation.op}("
                f"{get_public_name_from_mri(self.metric_object.metric_mri)})"
            )
        return self.generate_select_statements(
            projects=projects,
            use_case_id=use_case_id,
            alias=alias,
            params=params,
        )

    def generate_where_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        if not self.metric_operation.validate_can_filter():
            raise InvalidParams(
                f"Cannot filter by metrics expression {self.metric_operation.op}("
                f"{get_public_name_from_mri(self.metric_object.metric_mri)})"
            )
        return self.generate_select_statements(
            projects=projects,
            use_case_id=use_case_id,
            alias=alias,
            params=params,
        )

    def get_meta_type(self) -> str | None:
        return self.metric_operation.get_meta_type()


@dataclass
class DerivedMetricExpressionDefinition:
    metric_mri: str
    metrics: list[str]
    unit: str
    op: str | None = None
    meta_type: str | None = None
    result_type: MetricType | None = None
    # TODO: better typing
    # snql attribute is a function that takes optional args that map to strings that are MRIs for
    # the derived metric, org_id, metric_ids required to generate the snql and a string alias,
    # and in return, return snql that snuba can understand and represents how to query for the
    # derived metric
    snql: Callable[..., Function] | None = None
    post_query_func: Any = lambda *args: args


class DerivedMetricExpression(DerivedMetricExpressionDefinition, MetricExpressionBase, ABC):
    def _raise_entity_validation_exception(self, func_name: str) -> None:
        raise DerivedMetricParseException(
            f"Method `{func_name}` can only be called on instance of "
            f"{self.__class__.__name__} "
            f"{get_public_name_from_mri(self.metric_mri)} with a `projects` attribute."
        )

    def __str__(self) -> str:
        return self.metric_mri

    def get_meta_type(self) -> str | None:
        return self.meta_type


class SingularEntityDerivedMetric(DerivedMetricExpression):
    # Pretend for the typechecker that __init__ is not overridden, such that
    # SingularEntityDerivedMetric still has a strongly-typed ctor like its
    # baseclass.
    if not TYPE_CHECKING:

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, **kwargs)
            self.result_type = "numeric"

            if self.snql is None:
                raise DerivedMetricParseException(
                    "SnQL cannot be None for instances of SingularEntityDerivedMetric"
                )

    def validate_can_orderby(self) -> None:
        return

    @classmethod
    def __recursively_get_all_entities_in_derived_metric_dependency_tree(
        cls, derived_metric_mri: str, projects: Sequence[Project], use_case_id: UseCaseID
    ) -> set[MetricEntity]:
        """
        Method that gets the entity of a derived metric by traversing down its dependency tree
        until it gets to the raw metrics (leaf nodes) then queries snuba to check which
        entity/entities these raw constituent metrics belong to.
        """
        all_derived_metrics = get_derived_metrics()
        if derived_metric_mri not in all_derived_metrics():
            return {_get_entity_of_metric_mri(projects, derived_metric_mri, use_case_id).value}

        entities = set()
        derived_metric = all_derived_metrics[derived_metric_mri]

        for metric_mri in derived_metric.metrics:
            entities |= cls.__recursively_get_all_entities_in_derived_metric_dependency_tree(
                metric_mri, projects, use_case_id
            )
        return entities

    def get_entity(
        self, projects: QuerySet[Project] | Sequence[Project], use_case_id: UseCaseID
    ) -> MetricEntity:
        if not projects:
            self._raise_entity_validation_exception("get_entity")
        try:
            entities = self.__recursively_get_all_entities_in_derived_metric_dependency_tree(
                derived_metric_mri=self.metric_mri, projects=projects, use_case_id=use_case_id
            )
        except InvalidParams:
            raise MetricDoesNotExistException()
        if len(entities) != 1 or entities == {None}:
            raise DerivedMetricParseException(
                f"Derived Metric "
                f"{get_public_name_from_mri(self.metric_mri)} cannot be calculated from a single "
                f"entity"
            )
        return entities.pop()

    @classmethod
    def __recursively_generate_metric_ids(
        cls, org_id: int, derived_metric_mri: str, use_case_id: UseCaseID
    ) -> set[int]:
        """
        Method that traverses a derived metric dependency tree to return a set of the metric ids
        of its constituent metrics
        """
        all_derived_metrics = get_derived_metrics()
        if derived_metric_mri not in all_derived_metrics:
            return set()
        derived_metric = all_derived_metrics[derived_metric_mri]
        ids = set()
        for metric_mri in derived_metric.metrics:
            if metric_mri not in all_derived_metrics:
                ids.add(resolve_weak(use_case_id, org_id, metric_mri))
            else:
                ids |= cls.__recursively_generate_metric_ids(org_id, metric_mri, use_case_id)
        return ids

    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> set[int]:
        org_id = org_id_from_projects(projects)
        return self.__recursively_generate_metric_ids(
            org_id, derived_metric_mri=self.metric_mri, use_case_id=use_case_id
        )

    @classmethod
    def __recursively_generate_select_snql(
        cls,
        project_ids: Sequence[int],
        org_id: int,
        derived_metric_mri: str,
        use_case_id: UseCaseID,
        alias: str | None = None,
    ) -> list[Function]:
        """
        Method that generates the SnQL representation for the derived metric
        """
        all_derived_metrics = get_derived_metrics()
        if derived_metric_mri not in all_derived_metrics:
            return []
        derived_metric = all_derived_metrics[derived_metric_mri]
        arg_snql = []
        for arg in derived_metric.metrics:
            arg_snql += cls.__recursively_generate_select_snql(
                project_ids, org_id, arg, use_case_id
            )

        if alias is None:
            # Aliases on components of SingularEntityDerivedMetric do not really matter as these evaluate to a single
            # expression, and so what matters is the alias on that top level expression
            alias = derived_metric_mri

        assert derived_metric.snql is not None
        return [
            derived_metric.snql(
                *arg_snql,
                project_ids=project_ids,
                org_id=org_id,
                metric_ids=cls.__recursively_generate_metric_ids(
                    org_id, derived_metric_mri, use_case_id
                ),
                alias=alias,
            )
        ]

    def generate_select_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        # Before, we are able to generate the relevant SnQL for a derived metric, we need to
        # validate that this instance of SingularEntityDerivedMetric is built from constituent
        # metrics that span a single entity
        if not projects:
            self._raise_entity_validation_exception("generate_select_statements")
        self.get_entity(projects=projects, use_case_id=use_case_id)
        project_ids = [project.id for project in projects]
        org_id = org_id_from_projects(projects)
        # Currently `params` is not being used in instances of `SingularEntityDerivedMetric` and
        # `CompositeEntityDerivedMetric` instances as these types of expressions produce SnQL that does not require any
        # parameters but in the future that might change, and when that occurs we will need to pass the params to the
        # `snql` function of the derived metric
        return self.__recursively_generate_select_snql(
            project_ids=project_ids,
            org_id=org_id,
            derived_metric_mri=self.metric_mri,
            use_case_id=use_case_id,
            alias=alias,
        )

    def generate_orderby_clause(
        self,
        direction: Direction,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[OrderBy]:
        if not projects:
            self._raise_entity_validation_exception("generate_orderby_clause")
        self.get_entity(projects=projects, use_case_id=use_case_id)
        return [
            OrderBy(
                self.generate_select_statements(
                    projects=projects,
                    params=params,
                    use_case_id=use_case_id,
                    alias=alias,
                )[0],
                direction,
            )
        ]

    def generate_default_null_values(self) -> int | list[tuple[float]] | None:
        default_null_value = None
        try:
            default_null_value = DEFAULT_AGGREGATES[UNIT_TO_TYPE[self.unit]]
        except KeyError:
            pass
        return default_null_value

    def generate_available_operations(self) -> Collection[MetricOperation]:
        return []

    def run_post_query_function(
        self,
        data: SnubaDataType,
        alias: str,
        params: MetricOperationParams | None = None,
        idx: int | None = None,
    ) -> Any:
        try:
            compute_func_args = [data[alias] if idx is None else data[alias][idx]]
        except KeyError:
            compute_func_args = [self.generate_default_null_values()]
        result = self.post_query_func(*compute_func_args)
        if isinstance(result, tuple) and len(result) == 1:
            result = result[0]
        return result

    def generate_bottom_up_derived_metrics_dependencies(
        self, alias: str
    ) -> Iterable[tuple[MetricOperationType | None, str, str]]:
        return [(None, self.metric_mri, alias)]

    def generate_groupby_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        raise InvalidParams(f"Cannot group by metric {get_public_name_from_mri(self.metric_mri)}")

    def generate_where_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        raise InvalidParams(f"Cannot filter by metric {get_public_name_from_mri(self.metric_mri)}")


class CompositeEntityDerivedMetric(DerivedMetricExpression):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.result_type = "numeric"

    def validate_can_orderby(self) -> None:
        raise NotSupportedOverCompositeEntityException()

    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> set[Any]:
        raise NotSupportedOverCompositeEntityException()

    def generate_select_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        raise NotSupportedOverCompositeEntityException()

    def generate_orderby_clause(
        self,
        direction: Direction,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[OrderBy]:
        raise OrderByNotSupportedOverCompositeEntityException(
            f"It is not possible to orderBy field "
            f"{get_public_name_from_mri(self.metric_mri)} as it does not "
            f"have a direct mapping to a query alias"
        )

    def generate_default_null_values(self) -> int | list[tuple[float]] | None:
        default_null_value = None
        try:
            default_null_value = DEFAULT_AGGREGATES[UNIT_TO_TYPE[self.unit]]
        except KeyError:
            pass
        return default_null_value

    def get_entity(
        self, projects: QuerySet[Project] | Sequence[Project], use_case_id: UseCaseID
    ) -> dict[MetricEntity, list[str]]:
        if not projects:
            self._raise_entity_validation_exception("get_entity")
        return self.__recursively_generate_singular_entity_constituents(
            projects=projects, derived_metric_obj=self, use_case_id=use_case_id
        )

    def generate_available_operations(self) -> Collection[MetricOperation]:
        return []

    @classmethod
    def __recursively_generate_singular_entity_constituents(
        cls,
        projects: Sequence[Project] | None,
        derived_metric_obj: DerivedMetricExpression,
        use_case_id: UseCaseID,
        is_naive: bool = False,
    ) -> dict[MetricEntity, list[str]]:
        entities_and_metric_mris: dict[MetricEntity, list[str]] = {}
        for metric_mri in derived_metric_obj.metrics:
            all_derived_metrics = get_derived_metrics()
            if metric_mri not in all_derived_metrics:
                continue
            constituent_metric_obj = all_derived_metrics[metric_mri]
            if isinstance(constituent_metric_obj, SingularEntityDerivedMetric):
                if is_naive:
                    entity = None
                else:
                    assert projects is not None
                    entity = constituent_metric_obj.get_entity(
                        projects=projects, use_case_id=use_case_id
                    )

                entities_and_metric_mris.setdefault(entity, []).append(
                    constituent_metric_obj.metric_mri
                )
                # We do not care about the components of a SingularEntityDerivedMetric
                continue

            # This is necessary because we don't want to override entity lists but rather append
            # to them
            entities_and_metric_mris = combine_dictionary_of_list_values(
                entities_and_metric_mris,
                cls.__recursively_generate_singular_entity_constituents(
                    projects, constituent_metric_obj, use_case_id, is_naive
                ),
            )

        return entities_and_metric_mris

    def generate_bottom_up_derived_metrics_dependencies(
        self, alias: str
    ) -> Iterable[tuple[MetricOperationType | None, str, str]]:
        # We are only interested in the dependency tree from instances of
        # CompositeEntityDerivedMetric as they don't have a direct mapping to SnQL and so
        # need to be computed post query which is practically when this function is called
        from collections import deque

        # Flag set to identify the root or the parent as it is the only node that receives the alias as while all child
        # nodes receive the suffix `__CHILD_OF__<parent_alias>`
        set_alias_root = False

        metric_nodes: Deque[DerivedMetricExpression] = deque()
        all_derived_metrics = get_derived_metrics()
        results = []
        metric_nodes.append(self)
        while metric_nodes:
            node = metric_nodes.popleft()
            if node.metric_mri in all_derived_metrics:
                if set_alias_root:
                    results.append(
                        (
                            None,
                            node.metric_mri,
                            f"{node.metric_mri}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}",
                        )
                    )
                else:
                    results.append((None, node.metric_mri, alias))
                    set_alias_root = True

                # We do not really care about getting the components of an instance of
                # SingularEntityDerivedMetric because there is a direct mapping to the response
                # returned by the dataset anyways
                if isinstance(node, SingularEntityDerivedMetric):
                    continue
            for metric in node.metrics:
                if metric in all_derived_metrics:
                    metric_nodes.append(all_derived_metrics[metric])
        return reversed(results)

    def naively_generate_singular_entity_constituents(self, use_case_id: UseCaseID) -> set[str]:
        single_entity_constituents = set(
            list(
                self.__recursively_generate_singular_entity_constituents(
                    projects=None, derived_metric_obj=self, use_case_id=use_case_id, is_naive=True
                ).values()
            ).pop()
        )
        return single_entity_constituents

    def run_post_query_function(
        self,
        data: SnubaDataType,
        alias: str,
        params: MetricOperationParams | None = None,
        idx: int | None = None,
    ) -> Any:
        if COMPOSITE_ENTITY_CONSTITUENT_ALIAS in alias:
            # Often times we have multi level nodes in the definition of a composite entity derived metric, and so
            # some of these nodes are both children of the root node and also parents of other nodes. In such cases,
            # they already have `__CHILD_OF__<parent_alias>` suffix, parent_alias being the root node alias. In these
            # cases, there is no need to add the parent alias again as how this model works is that there is a single
            # root node and all the children nodes get the `__CHILD_OF__<parent_alias>` suffix whether they are also
            # parents of other children nodes while being children of the root node or not.
            alias = alias.split(COMPOSITE_ENTITY_CONSTITUENT_ALIAS)[1]

        compute_func_args = []
        for constituent in self.metrics:
            key = f"{constituent}{COMPOSITE_ENTITY_CONSTITUENT_ALIAS}{alias}"
            (
                compute_func_args.append(data[key])
                if idx is None
                else compute_func_args.append(data[key][idx])
            )
        # ToDo(ahmed): This won't work if there is not post_query_func because there is an assumption that this function
        #  will aggregate the result somehow
        return self.post_query_func(*compute_func_args)

    def generate_groupby_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        raise InvalidParams(f"Cannot group by metric {get_public_name_from_mri(self.metric_mri)}")

    def generate_where_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: MetricOperationParams | None = None,
    ) -> list[Function]:
        raise InvalidParams(f"Cannot filter by metric {get_public_name_from_mri(self.metric_mri)}")


def metric_object_factory(
    op: MetricOperationType | None, metric_mri: str, use_metrics_v2: bool | None = None
) -> MetricExpressionBase:
    """Returns an appropriate instance of MetricsFieldBase object"""
    all_derived_ops = get_derived_ops(use_metrics_v2)
    all_derived_metrics = get_derived_metrics(use_metrics_v2)
    all_derived_aliases = get_derived_aliases(use_metrics_v2)
    if op in all_derived_ops and metric_mri in all_derived_metrics:
        raise InvalidParams("derived ops cannot be used on derived metrics")

    # This function is only used in the query builder, only after func `parse_field` validates
    # that no private derived metrics are required. The query builder requires access to all
    # derived metrics to be able to compute derived metrics that are not private but might have
    # private constituents
    if metric_mri in all_derived_metrics:
        return all_derived_metrics[metric_mri]

    # at this point we know we have an op. Add assertion to appease mypy
    assert op is not None

    metric_operation = all_derived_ops[op] if op in all_derived_ops else RawOp(op=op)

    metric_object = (
        all_derived_aliases[metric_mri]
        if metric_mri in all_derived_aliases
        else RawMetric(metric_mri)
    )

    return MetricExpression(metric_operation=metric_operation, metric_object=metric_object)


def generate_bottom_up_dependency_tree_for_metrics(
    metrics_query_fields_set: set[tuple[MetricOperationType | None, str, str]]
) -> list[tuple[MetricOperationType | None, str, str]]:
    """
    This function basically generates a dependency list for all instances of
    `CompositeEntityDerivedMetric` in a query definition fields set
    """
    dependency_list: list[tuple[MetricOperation | None, str, str]] = []
    for op, metric_mri, alias in metrics_query_fields_set:
        dependency_list.extend(
            metric_object_factory(op, metric_mri).generate_bottom_up_derived_metrics_dependencies(
                alias=alias
            )
        )
    return dependency_list
