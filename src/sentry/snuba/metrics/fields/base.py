from __future__ import annotations

import copy
import inspect
from abc import ABC, abstractmethod
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Collection,
    Deque,
    Dict,
    Iterable,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Set,
    Tuple,
    Union,
)

from snuba_sdk import Column, Condition, Entity, Function, Granularity, Op, Query, Request
from snuba_sdk.orderby import Direction, OrderBy

from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.search.events.constants import MISERY_ALPHA, MISERY_BETA
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.fields.histogram import ClickhouseHistogram, rebucket_histogram
from sentry.snuba.metrics.fields.snql import (
    abnormal_sessions,
    abnormal_users,
    addition,
    all_sessions,
    all_spans,
    all_transactions,
    all_users,
    anr_users,
    apdex,
    complement,
    count_transaction_name_snql_factory,
    count_web_vitals_snql_factory,
    crashed_sessions,
    crashed_users,
    division_float,
    errored_all_users,
    errored_preaggr_sessions,
    failure_count_transaction,
    foreground_anr_users,
    histogram_snql_factory,
    http_error_count_span,
    http_error_count_transaction,
    max_timestamp,
    min_timestamp,
    miserable_users,
    on_demand_apdex_snql_factory,
    on_demand_count_web_vitals_snql_factory,
    on_demand_epm_snql_factory,
    on_demand_eps_snql_factory,
    on_demand_failure_count_snql_factory,
    on_demand_failure_rate_snql_factory,
    on_demand_user_misery_snql_factory,
    rate_snql_factory,
    satisfaction_count_transaction,
    session_duration_filters,
    subtraction,
    sum_if_column_snql,
    team_key_transaction_snql,
    tolerated_count_transaction,
    uniq_aggregation_on_metric,
    uniq_if_column_snql,
)
from sentry.snuba.metrics.naming_layer.mapping import get_public_name_from_mri
from sentry.snuba.metrics.naming_layer.mri import SessionMRI, SpanMRI, TransactionMRI
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
    "DERIVED_METRICS",
    "generate_bottom_up_dependency_tree_for_metrics",
    "get_derived_metrics",
    "org_id_from_projects",
    "COMPOSITE_ENTITY_CONSTITUENT_ALIAS",
)

COMPOSITE_ENTITY_CONSTITUENT_ALIAS = "__CHILD_OF__"

SnubaDataType = Dict[str, Any]
PostQueryFuncReturnType = Optional[Union[Tuple[Any, ...], ClickhouseHistogram, int, float]]
MetricOperationParams = Mapping[str, Union[str, int, float]]


def run_metrics_query(
    *,
    entity_key: EntityKey,
    select: List[Column],
    where: List[Condition],
    groupby: List[Column],
    project_ids: Sequence[int],
    org_id: int,
    referrer: str,
    use_case_id: UseCaseID,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> List[SnubaDataType]:
    if end is None:
        end = datetime.now()
    if start is None:
        start = end - timedelta(hours=24)

    # Round timestamp to minute to get cache efficiency:
    # Also floor start to match the daily granularity
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
        dataset=Dataset.Metrics.value,
        app_id="metrics",
        query=query,
        tenant_ids={"organization_id": org_id, "use_case_id": use_case_id.value},
    )
    result = raw_snql_query(request, referrer, use_cache=True)
    return result["data"]


def _get_known_entity_of_metric_mri(metric_mri: str) -> Optional[EntityKey]:
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
    projects: Sequence[Project], metric_mri: str, use_case_id: UseCaseID
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
    filters: Optional[Callable[..., Function]] = None


class MetricObject(MetricObjectDefinition, ABC):
    """
    Represents an object that encapsulates a metric_mri or to be more accurate what's between
    the parentheses in an expression that looks like `sum(sentry.sessions.session)`
    """

    @abstractmethod
    def generate_filter_snql_conditions(self, org_id: int, use_case_id: UseCaseID) -> Function:
        raise NotImplementedError

    @abstractmethod
    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> Set[int]:
        raise NotImplementedError


class RawMetric(MetricObject):
    """
    Represents a class where the metric object just encapsulates a string name identifier for a
    metric
    """

    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> Set[int]:
        return {resolve_weak(use_case_id, org_id_from_projects(projects), self.metric_mri)}

    def generate_filter_snql_conditions(self, org_id: int, use_case_id: UseCaseID) -> Function:
        return Function(
            "equals",
            [Column("metric_id"), resolve_weak(use_case_id, org_id, self.metric_mri)],
        )


class AliasedDerivedMetric(AliasedDerivedMetricDefinition, MetricObject):
    """
    Represents a class where metric object is a class that encapsulates filter logic on an alias
    for a raw metric name
    """

    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> Set[int]:
        return {resolve_weak(use_case_id, org_id_from_projects(projects), self.raw_metric_mri)}

    def generate_filter_snql_conditions(self, org_id: int, use_case_id: UseCaseID) -> Function:
        conditions = [
            Function(
                "equals",
                [
                    Column("metric_id"),
                    resolve_weak(use_case_id, org_id, self.raw_metric_mri),
                ],
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
        idx: Optional[int] = None,
        params: Optional[MetricOperationParams] = None,
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
        params: Optional[MetricOperationParams] = None,
    ) -> Function:
        raise NotImplementedError

    @abstractmethod
    def get_default_null_values(self) -> Optional[Union[int, List[Tuple[float]]]]:
        raise NotImplementedError

    @abstractmethod
    def get_meta_type(self) -> Optional[str]:
        raise NotImplementedError


@dataclass
class DerivedOpDefinition(MetricOperationDefinition):
    can_orderby: bool
    can_groupby: bool = False
    can_filter: bool = False
    meta_type: Optional[str] = None
    post_query_func: Callable[..., PostQueryFuncReturnType] = lambda data, *args: data
    snql_func: Callable[..., Optional[Function]] = lambda _: None
    default_null_value: Optional[Union[int, List[Tuple[float]]]] = None


class RawOp(MetricOperation):
    def validate_can_orderby(self) -> None:
        return

    def validate_can_groupby(self) -> bool:
        return False

    def validate_can_filter(self) -> bool:
        return False

    def get_meta_type(self) -> Optional[str]:
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
        idx: Optional[int] = None,
        params: Optional[MetricOperationParams] = None,
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
        params: Optional[MetricOperationParams] = None,
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

    def get_default_null_values(self) -> Optional[Union[int, List[Tuple[float]]]]:
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

    def get_meta_type(self) -> Optional[str]:
        return self.meta_type

    def run_post_query_function(
        self,
        data: SnubaDataType,
        metric_mri: str,
        alias: str,
        idx: Optional[int] = None,
        params: Optional[MetricOperationParams] = None,
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
        params: Optional[MetricOperationParams] = None,
    ) -> Function:
        metrics_query_args = inspect.signature(self.snql_func).parameters.keys()
        kwargs: MutableMapping[str, Union[float, int, str, UseCaseID, Function]] = {}

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

    def get_default_null_values(self) -> Optional[Union[int, List[Tuple[float]]]]:
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
        self, projects: Sequence[Project], use_case_id: UseCaseID
    ) -> Union[MetricEntity, Dict[MetricEntity, Sequence[str]]]:
        """
        Method that generates the entity of an instance of MetricsFieldBase.
        `entity` property will always be None for instances of DerivedMetric that rely on
        constituent metrics that span multiple entities.
        """
        raise NotImplementedError

    @abstractmethod
    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> Set[int]:
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
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
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
        params: Optional[MetricOperationParams] = None,
    ) -> List[OrderBy]:
        """
        Method that generates a list of SnQL OrderBy clauses based on an instance of
        MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_default_null_values(self) -> Optional[Union[int, List[Tuple[float]]]]:
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
        params: Optional[MetricOperationParams] = None,
        idx: Optional[int] = None,
    ) -> Any:
        """
        Method that runs functions on the values returned from the query
        """
        raise NotImplementedError

    @abstractmethod
    def generate_bottom_up_derived_metrics_dependencies(
        self, alias: str
    ) -> Iterable[Tuple[Optional[MetricOperation], str, str]]:
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
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
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
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
        """
        Method that generates a list of SnQL where statements based on whether an instance of MetricsFieldBase
        supports it
        """
        raise NotImplementedError

    @abstractmethod
    def get_meta_type(self) -> Optional[str]:
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

    def get_entity(self, projects: Sequence[Project], use_case_id: UseCaseID) -> MetricEntity:
        return _get_entity_of_metric_mri(projects, self.metric_object.metric_mri, use_case_id).value

    def generate_select_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
        org_id = org_id_from_projects(projects)
        return [
            self.build_conditional_aggregate_for_metric(
                org_id,
                entity=self.get_entity(projects, use_case_id),
                use_case_id=use_case_id,
                alias=alias,
                params=params,
            )
        ]

    def generate_orderby_clause(
        self,
        direction: Direction,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: Optional[MetricOperationParams] = None,
    ) -> List[OrderBy]:
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

    def generate_default_null_values(self) -> Optional[Union[int, List[Tuple[float]]]]:
        return self.metric_operation.get_default_null_values()

    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> Set[int]:
        return self.metric_object.generate_metric_ids(projects, use_case_id)

    def run_post_query_function(
        self,
        data: SnubaDataType,
        alias: str,
        params: Optional[MetricOperationParams] = None,
        idx: Optional[int] = None,
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
    ) -> Iterable[Tuple[MetricOperationType, str, str]]:
        return [(self.metric_operation.op, self.metric_object.metric_mri, alias)]

    def build_conditional_aggregate_for_metric(
        self,
        org_id: int,
        entity: MetricEntity,
        use_case_id: UseCaseID,
        alias: str,
        params: Optional[MetricOperationParams] = None,
    ) -> Function:
        # We don't pass params to the metric object because params are usually applied on the operation not on the
        # metric object/name
        conditions = self.metric_object.generate_filter_snql_conditions(
            org_id=org_id, use_case_id=use_case_id
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
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
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
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
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

    def get_meta_type(self) -> Optional[str]:
        return self.metric_operation.get_meta_type()


@dataclass
class DerivedMetricExpressionDefinition:
    metric_mri: str
    metrics: List[str]
    unit: str
    op: Optional[str] = None
    meta_type: Optional[str] = None
    result_type: Optional[MetricType] = None
    # TODO: better typing
    # snql attribute is a function that takes optional args that map to strings that are MRIs for
    # the derived metric, org_id, metric_ids required to generate the snql and a string alias,
    # and in return, return snql that snuba can understand and represents how to query for the
    # derived metric
    snql: Optional[Callable[..., Function]] = None
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

    def get_meta_type(self) -> Optional[str]:
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
    ) -> Set[MetricEntity]:
        """
        Method that gets the entity of a derived metric by traversing down its dependency tree
        until it gets to the raw metrics (leaf nodes) then queries snuba to check which
        entity/entities these raw constituent metrics belong to.
        """
        if derived_metric_mri not in DERIVED_METRICS:
            return {_get_entity_of_metric_mri(projects, derived_metric_mri, use_case_id).value}

        entities = set()
        derived_metric = DERIVED_METRICS[derived_metric_mri]

        for metric_mri in derived_metric.metrics:
            entities |= cls.__recursively_get_all_entities_in_derived_metric_dependency_tree(
                metric_mri, projects, use_case_id
            )
        return entities

    def get_entity(self, projects: Sequence[Project], use_case_id: UseCaseID) -> MetricEntity:
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
    ) -> Set[int]:
        """
        Method that traverses a derived metric dependency tree to return a set of the metric ids
        of its constituent metrics
        """
        if derived_metric_mri not in DERIVED_METRICS:
            return set()
        derived_metric = DERIVED_METRICS[derived_metric_mri]
        ids = set()
        for metric_mri in derived_metric.metrics:
            if metric_mri not in DERIVED_METRICS:
                ids.add(resolve_weak(use_case_id, org_id, metric_mri))
            else:
                ids |= cls.__recursively_generate_metric_ids(org_id, metric_mri, use_case_id)
        return ids

    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> Set[int]:
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
        alias: Optional[str] = None,
    ) -> List[Function]:
        """
        Method that generates the SnQL representation for the derived metric
        """
        if derived_metric_mri not in DERIVED_METRICS:
            return []
        derived_metric = DERIVED_METRICS[derived_metric_mri]
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
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
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
        params: Optional[MetricOperationParams] = None,
    ) -> List[OrderBy]:
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

    def generate_default_null_values(self) -> Optional[Union[int, List[Tuple[float]]]]:
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
        params: Optional[MetricOperationParams] = None,
        idx: Optional[int] = None,
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
    ) -> Iterable[Tuple[Optional[MetricOperationType], str, str]]:
        return [(None, self.metric_mri, alias)]

    def generate_groupby_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
        raise InvalidParams(f"Cannot group by metric {get_public_name_from_mri(self.metric_mri)}")

    def generate_where_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
        raise InvalidParams(f"Cannot filter by metric {get_public_name_from_mri(self.metric_mri)}")


class CompositeEntityDerivedMetric(DerivedMetricExpression):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.result_type = "numeric"

    def validate_can_orderby(self) -> None:
        raise NotSupportedOverCompositeEntityException()

    def generate_metric_ids(self, projects: Sequence[Project], use_case_id: UseCaseID) -> Set[Any]:
        raise NotSupportedOverCompositeEntityException()

    def generate_select_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
        raise NotSupportedOverCompositeEntityException()

    def generate_orderby_clause(
        self,
        direction: Direction,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: Optional[MetricOperationParams] = None,
    ) -> List[OrderBy]:
        raise OrderByNotSupportedOverCompositeEntityException(
            f"It is not possible to orderBy field "
            f"{get_public_name_from_mri(self.metric_mri)} as it does not "
            f"have a direct mapping to a query alias"
        )

    def generate_default_null_values(self) -> Optional[Union[int, List[Tuple[float]]]]:
        default_null_value = None
        try:
            default_null_value = DEFAULT_AGGREGATES[UNIT_TO_TYPE[self.unit]]
        except KeyError:
            pass
        return default_null_value

    def get_entity(
        self, projects: Sequence[Project], use_case_id: UseCaseID
    ) -> Dict[MetricEntity, List[str]]:
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
        projects: Optional[Sequence[Project]],
        derived_metric_obj: DerivedMetricExpression,
        use_case_id: UseCaseID,
        is_naive: bool = False,
    ) -> Dict[MetricEntity, List[str]]:
        entities_and_metric_mris: Dict[MetricEntity, List[str]] = {}
        for metric_mri in derived_metric_obj.metrics:
            if metric_mri not in DERIVED_METRICS:
                continue
            constituent_metric_obj = DERIVED_METRICS[metric_mri]
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
    ) -> Iterable[Tuple[Optional[MetricOperationType], str, str]]:
        # We are only interested in the dependency tree from instances of
        # CompositeEntityDerivedMetric as they don't have a direct mapping to SnQL and so
        # need to be computed post query which is practically when this function is called
        from collections import deque

        # Flag set to identify the root or the parent as it is the only node that receives the alias as while all child
        # nodes receive the suffix `__CHILD_OF__<parent_alias>`
        set_alias_root = False

        metric_nodes: Deque[DerivedMetricExpression] = deque()

        results = []
        metric_nodes.append(self)
        while metric_nodes:
            node = metric_nodes.popleft()
            if node.metric_mri in DERIVED_METRICS:
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
                if metric in DERIVED_METRICS:
                    metric_nodes.append(DERIVED_METRICS[metric])
        return reversed(results)

    def naively_generate_singular_entity_constituents(self, use_case_id: UseCaseID) -> Set[str]:
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
        params: Optional[MetricOperationParams] = None,
        idx: Optional[int] = None,
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
            compute_func_args.append(data[key]) if idx is None else compute_func_args.append(
                data[key][idx]
            )
        # ToDo(ahmed): This won't work if there is not post_query_func because there is an assumption that this function
        #  will aggregate the result somehow
        return self.post_query_func(*compute_func_args)

    def generate_groupby_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
        raise InvalidParams(f"Cannot group by metric {get_public_name_from_mri(self.metric_mri)}")

    def generate_where_statements(
        self,
        projects: Sequence[Project],
        use_case_id: UseCaseID,
        alias: str,
        params: Optional[MetricOperationParams] = None,
    ) -> List[Function]:
        raise InvalidParams(f"Cannot filter by metric {get_public_name_from_mri(self.metric_mri)}")


# ToDo(ahmed): Investigate dealing with derived metric keys as Enum objects rather than string
#  values
DERIVED_METRICS = {
    derived_metric.metric_mri: derived_metric
    for derived_metric in [
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ALL.value,
            metrics=[SessionMRI.RAW_SESSION.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ALL_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ABNORMAL.value,
            metrics=[SessionMRI.RAW_SESSION.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: abnormal_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ABNORMAL_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: abnormal_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED.value,
            metrics=[SessionMRI.RAW_SESSION.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: crashed_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: crashed_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ANR_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: anr_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.FOREGROUND_ANR_USER.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: foreground_anr_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_RATE.value,
            metrics=[SessionMRI.CRASHED.value, SessionMRI.ALL.value],
            unit="percentage",
            snql=lambda crashed_count, all_count, project_ids, org_id, metric_ids, alias=None: division_float(
                crashed_count, all_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_USER_RATE.value,
            metrics=[
                SessionMRI.CRASHED_USER.value,
                SessionMRI.ALL_USER.value,
            ],
            unit="percentage",
            snql=lambda crashed_user_count, all_user_count, project_ids, org_id, metric_ids, alias=None: division_float(
                crashed_user_count, all_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ANR_RATE.value,
            metrics=[
                SessionMRI.ANR_USER.value,
                SessionMRI.ALL_USER.value,
            ],
            unit="percentage",
            snql=lambda anr_user_count, all_user_count, project_ids, org_id, metric_ids, alias=None: division_float(
                anr_user_count, all_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.FOREGROUND_ANR_RATE.value,
            metrics=[
                SessionMRI.FOREGROUND_ANR_USER.value,
                SessionMRI.ALL_USER.value,
            ],
            unit="percentage",
            snql=lambda foreground_anr_user_count, all_user_count, project_ids, org_id, metric_ids, alias=None: division_float(
                foreground_anr_user_count, all_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE_RATE.value,
            metrics=[SessionMRI.CRASH_RATE.value],
            unit="percentage",
            snql=lambda crash_rate_value, project_ids, org_id, metric_ids, alias=None: complement(
                crash_rate_value, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE.value,
            metrics=[SessionMRI.ALL.value, SessionMRI.CRASHED.value],
            unit="sessions",
            snql=lambda all_count, crashed_count, project_ids, org_id, metric_ids, alias=None: subtraction(
                all_count, crashed_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE_USER_RATE.value,
            metrics=[SessionMRI.CRASH_USER_RATE.value],
            unit="percentage",
            snql=lambda crash_user_rate_value, project_ids, org_id, metric_ids, alias=None: complement(
                crash_user_rate_value, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE_USER.value,
            metrics=[
                SessionMRI.ALL_USER.value,
                SessionMRI.CRASHED_USER.value,
            ],
            unit="users",
            snql=lambda all_user_count, crashed_user_count, project_ids, org_id, metric_ids, alias=None: subtraction(
                all_user_count, crashed_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_PREAGGREGATED.value,
            metrics=[SessionMRI.RAW_SESSION.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: errored_preaggr_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_SET.value,
            metrics=[SessionMRI.RAW_ERROR.value],
            unit="sessions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: uniq_aggregation_on_metric(
                metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED_AND_ABNORMAL.value,
            metrics=[
                SessionMRI.CRASHED.value,
                SessionMRI.ABNORMAL.value,
            ],
            unit="sessions",
            snql=lambda crashed_count, abnormal_count, project_ids, org_id, metric_ids, alias=None: addition(
                crashed_count, abnormal_count, alias=alias
            ),
        ),
        CompositeEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_ALL.value,
            metrics=[
                SessionMRI.ERRORED_PREAGGREGATED.value,
                SessionMRI.ERRORED_SET.value,
            ],
            unit="sessions",
            post_query_func=lambda *args: sum([*args]),
        ),
        CompositeEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED.value,
            metrics=[
                SessionMRI.ERRORED_ALL.value,
                SessionMRI.CRASHED_AND_ABNORMAL.value,
            ],
            unit="sessions",
            post_query_func=lambda errored_all, crashed_abnormal: max(
                0, errored_all - crashed_abnormal
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_USER_ALL.value,
            metrics=[SessionMRI.RAW_USER.value],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: errored_all_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED_AND_ABNORMAL_USER.value,
            metrics=[
                SessionMRI.CRASHED_USER.value,
                SessionMRI.ABNORMAL_USER.value,
            ],
            unit="users",
            snql=lambda crashed_user_count, abnormal_user_count, project_ids, org_id, metric_ids, alias=None: addition(
                crashed_user_count, abnormal_user_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_USER.value,
            metrics=[
                SessionMRI.ERRORED_USER_ALL.value,
                SessionMRI.CRASHED_AND_ABNORMAL_USER.value,
            ],
            unit="users",
            snql=lambda errored_user_all_count, crashed_and_abnormal_user_count, project_ids, org_id, metric_ids, alias=None: subtraction(
                errored_user_all_count, crashed_and_abnormal_user_count, alias=alias
            ),
            post_query_func=lambda *args: max(0, *args),
        ),
        CompositeEntityDerivedMetric(
            metric_mri=SessionMRI.HEALTHY.value,
            metrics=[
                SessionMRI.ALL.value,
                SessionMRI.ERRORED_ALL.value,
            ],
            unit="sessions",
            post_query_func=lambda init, errored: max(0, init - errored),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.HEALTHY_USER.value,
            metrics=[
                SessionMRI.ALL_USER.value,
                SessionMRI.ERRORED_USER_ALL.value,
            ],
            unit="users",
            snql=lambda all_user_count, errored_user_all_count, project_ids, org_id, metric_ids, alias=None: subtraction(
                all_user_count, errored_user_all_count, alias=alias
            ),
            post_query_func=lambda *args: max(0, *args),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.ALL.value,
            metrics=[TransactionMRI.DURATION.value, TransactionMRI.MEASUREMENTS_LCP.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_transactions(
                project_ids=project_ids, org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.FAILURE_COUNT.value,
            metrics=[TransactionMRI.DURATION.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: failure_count_transaction(
                org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.FAILURE_RATE.value,
            metrics=[
                TransactionMRI.FAILURE_COUNT.value,
                TransactionMRI.ALL.value,
            ],
            unit="transactions",
            snql=lambda failure_count, tx_count, project_ids, org_id, metric_ids, alias=None: division_float(
                failure_count, tx_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.HTTP_ERROR_COUNT.value,
            metrics=[TransactionMRI.DURATION.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: http_error_count_transaction(
                org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.HTTP_ERROR_RATE.value,
            metrics=[
                TransactionMRI.HTTP_ERROR_COUNT.value,
                TransactionMRI.ALL.value,
            ],
            unit="transactions",
            snql=lambda http_error_count, tx_count, project_ids, org_id, metric_ids, alias=None: division_float(
                http_error_count, tx_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.ALL.value,
            metrics=[SpanMRI.SELF_TIME.value],
            unit="spans",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_spans(
                metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.ALL_LIGHT.value,
            metrics=[SpanMRI.SELF_TIME_LIGHT.value],
            unit="spans",
            snql=lambda project_ids, org_id, metric_ids, alias=None: all_spans(
                metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.HTTP_ERROR_COUNT.value,
            metrics=[SpanMRI.SELF_TIME.value],
            unit="spans",
            snql=lambda project_ids, org_id, metric_ids, alias=None: http_error_count_span(
                org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.HTTP_ERROR_RATE.value,
            metrics=[
                SpanMRI.HTTP_ERROR_COUNT.value,
                SpanMRI.ALL.value,
            ],
            unit="transactions",
            snql=lambda http_error_count, tx_count, project_ids, org_id, metric_ids, alias=None: division_float(
                http_error_count, tx_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.HTTP_ERROR_COUNT_LIGHT.value,
            metrics=[SpanMRI.SELF_TIME_LIGHT.value],
            unit="spans",
            snql=lambda project_ids, org_id, metric_ids, alias=None: http_error_count_span(
                org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SpanMRI.HTTP_ERROR_RATE_LIGHT.value,
            metrics=[
                SpanMRI.HTTP_ERROR_COUNT_LIGHT.value,
                SpanMRI.ALL_LIGHT.value,
            ],
            unit="transactions",
            snql=lambda http_error_count, tx_count, project_ids, org_id, metric_ids, alias=None: division_float(
                http_error_count, tx_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.SATISFIED.value,
            metrics=[TransactionMRI.DURATION.value, TransactionMRI.MEASUREMENTS_LCP.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: satisfaction_count_transaction(
                project_ids=project_ids, org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.TOLERATED.value,
            metrics=[TransactionMRI.DURATION.value, TransactionMRI.MEASUREMENTS_LCP.value],
            unit="transactions",
            snql=lambda project_ids, org_id, metric_ids, alias=None: tolerated_count_transaction(
                project_ids=project_ids, org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.APDEX.value,
            metrics=[
                TransactionMRI.SATISFIED.value,
                TransactionMRI.TOLERATED.value,
                TransactionMRI.ALL.value,
            ],
            unit="percentage",
            snql=lambda satisfied, tolerated, total, project_ids, org_id, metric_ids, alias=None: apdex(
                satisfied, tolerated, total, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.MISERABLE_USER.value,
            metrics=[
                TransactionMRI.USER.value,
            ],
            unit="users",
            snql=lambda project_ids, org_id, metric_ids, alias=None: miserable_users(
                org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.ALL_USER.value,
            metrics=[TransactionMRI.USER.value],
            unit="percentage",
            snql=lambda project_ids, org_id, metric_ids, alias=None: uniq_aggregation_on_metric(
                metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.USER_MISERY.value,
            metrics=[TransactionMRI.MISERABLE_USER.value, TransactionMRI.ALL_USER.value],
            unit="percentage",
            snql=lambda miserable_user, user, project_ids, org_id, metric_ids, alias=None: division_float(
                addition(miserable_user, MISERY_ALPHA),
                addition(user, MISERY_ALPHA + MISERY_BETA),
                alias,
            ),
        ),
    ]
}

DERIVED_OPS: Mapping[MetricOperationType, DerivedOp] = {
    derived_op.op: derived_op
    for derived_op in [
        DerivedOp(
            op="histogram",
            can_orderby=False,
            post_query_func=rebucket_histogram,
            snql_func=histogram_snql_factory,
            default_null_value=[],
        ),
        DerivedOp(
            op="rate",
            can_orderby=True,
            snql_func=rate_snql_factory,
            default_null_value=0,
        ),
        DerivedOp(
            op="count_web_vitals",
            can_orderby=True,
            snql_func=count_web_vitals_snql_factory,
            default_null_value=0,
        ),
        DerivedOp(
            op="count_transaction_name",
            can_orderby=True,
            snql_func=count_transaction_name_snql_factory,
            default_null_value=0,
        ),
        # This specific derived operation doesn't require a metric_mri supplied to the MetricField but
        # in order to avoid breaking the contract we should always pass it. When using it in the orderby
        # clause you should put a metric mri with the same entity as the only entity used in the select.
        # E.g. if you have a select with user_misery which is a set entity and team_key_transaction and you want
        # to order by team_key_transaction, you will have to supply to the team_key_transaction MetricField
        # an mri that has the set entity.
        #
        # OrderBy(
        #     field=MetricField(
        #         op="team_key_transaction",
        #         # This has entity type set, which is the entity type of the select (in the select you can only have
        #         one entity type across selections if you use the team_key_transaction in the order by).
        #         metric_mri=TransactionMRI.USER.value,
        #         params={
        #             "team_key_condition_rhs": [
        #                 (self.project.id, "foo_transaction"),
        #             ]
        #         },
        #         alias="team_key_transactions",
        #     ),
        #     direction=Direction.DESC,
        # )
        DerivedOp(
            op="team_key_transaction",
            can_orderby=True,
            can_groupby=True,
            can_filter=True,
            snql_func=team_key_transaction_snql,
            default_null_value=0,
            meta_type="boolean",
        ),
        DerivedOp(
            op="sum_if_column",
            can_orderby=True,
            snql_func=sum_if_column_snql,
            default_null_value=0,
        ),
        DerivedOp(
            op="uniq_if_column",
            can_orderby=True,
            snql_func=uniq_if_column_snql,
            default_null_value=0,
        ),
        DerivedOp(
            op="min_timestamp",
            can_groupby=True,
            can_orderby=True,
            can_filter=True,
            snql_func=min_timestamp,
            meta_type="datetime",
            default_null_value=None,
        ),
        DerivedOp(
            op="max_timestamp",
            can_groupby=True,
            can_orderby=True,
            can_filter=True,
            snql_func=max_timestamp,
            meta_type="datetime",
            default_null_value=None,
        ),
        # Custom operations used for on demand derived metrics.
        DerivedOp(
            op="on_demand_apdex",
            can_orderby=True,
            snql_func=on_demand_apdex_snql_factory,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_epm",
            can_orderby=True,
            snql_func=on_demand_epm_snql_factory,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_eps",
            can_orderby=True,
            snql_func=on_demand_eps_snql_factory,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_failure_count",
            can_orderby=True,
            snql_func=on_demand_failure_count_snql_factory,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_failure_rate",
            can_orderby=True,
            snql_func=on_demand_failure_rate_snql_factory,
            default_null_value=0,
        ),
        DerivedOp(
            op="on_demand_count_web_vitals",
            can_orderby=True,
            snql_func=on_demand_count_web_vitals_snql_factory,
        ),
        DerivedOp(
            op="on_demand_user_misery",
            can_orderby=True,
            snql_func=on_demand_user_misery_snql_factory,
            default_null_value=0,
        ),
    ]
}

DERIVED_ALIASES: Mapping[str, AliasedDerivedMetric] = {
    derived_alias.metric_mri: derived_alias
    for derived_alias in [
        AliasedDerivedMetric(
            metric_mri=SessionMRI.DURATION.value,
            raw_metric_mri=SessionMRI.RAW_DURATION.value,
            filters=lambda *_, org_id: session_duration_filters(org_id),
        )
    ]
}


def metric_object_factory(
    op: Optional[MetricOperationType], metric_mri: str
) -> MetricExpressionBase:
    """Returns an appropriate instance of MetricsFieldBase object"""
    if op in DERIVED_OPS and metric_mri in DERIVED_METRICS:
        raise InvalidParams("derived ops cannot be used on derived metrics")

    # This function is only used in the query builder, only after func `parse_field` validates
    # that no private derived metrics are required. The query builder requires access to all
    # derived metrics to be able to compute derived metrics that are not private but might have
    # private constituents
    derived_metrics = get_derived_metrics()
    if metric_mri in derived_metrics:
        return derived_metrics[metric_mri]

    # at this point we know we have an op. Add assertion to appease mypy
    assert op is not None

    metric_operation = DERIVED_OPS[op] if op in DERIVED_OPS else RawOp(op=op)

    metric_object = (
        DERIVED_ALIASES[metric_mri] if metric_mri in DERIVED_ALIASES else RawMetric(metric_mri)
    )

    return MetricExpression(metric_operation=metric_operation, metric_object=metric_object)


def generate_bottom_up_dependency_tree_for_metrics(
    metrics_query_fields_set: Set[Tuple[Optional[MetricOperationType], str, str]]
) -> List[Tuple[Optional[MetricOperationType], str, str]]:
    """
    This function basically generates a dependency list for all instances of
    `CompositeEntityDerivedMetric` in a query definition fields set
    """
    dependency_list: List[Tuple[Optional[MetricOperation], str, str]] = []
    for op, metric_mri, alias in metrics_query_fields_set:
        dependency_list.extend(
            metric_object_factory(op, metric_mri).generate_bottom_up_derived_metrics_dependencies(
                alias=alias
            )
        )
    return dependency_list


def get_derived_metrics() -> Mapping[str, DerivedMetricExpression]:
    return DERIVED_METRICS
