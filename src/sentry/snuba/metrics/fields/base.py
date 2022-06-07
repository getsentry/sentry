from __future__ import annotations

import copy
import typing
from abc import ABC, abstractmethod
from dataclasses import dataclass
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
    Optional,
    Sequence,
    Set,
    Tuple,
    Union,
    cast,
)

from snuba_sdk import Column, Condition, Entity, Function, Granularity, Op, Query, Request
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.utils import InvalidParams
from sentry.models import Project
from sentry.search.events.constants import MISERY_ALPHA, MISERY_BETA
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.fields.histogram import (
    ClickhouseHistogram,
    rebucket_histogram,
    zoom_histogram,
)
from sentry.snuba.metrics.fields.snql import (
    abnormal_sessions,
    abnormal_users,
    addition,
    all_sessions,
    all_transactions,
    all_users,
    apdex,
    complement,
    crashed_sessions,
    crashed_users,
    division_float,
    errored_all_users,
    errored_preaggr_sessions,
    failure_count_transaction,
    miserable_users,
    satisfaction_count_transaction,
    session_duration_filters,
    subtraction,
    tolerated_count_transaction,
    uniq_aggregation_on_metric,
)
from sentry.snuba.metrics.naming_layer.mapping import get_public_name_from_mri
from sentry.snuba.metrics.naming_layer.mri import SessionMRI, TransactionMRI
from sentry.snuba.metrics.utils import (
    DEFAULT_AGGREGATES,
    GRANULARITY,
    METRIC_TYPE_TO_ENTITY,
    OP_TO_SNUBA_FUNCTION,
    OPERATIONS_TO_ENTITY,
    TS_COL_QUERY,
    UNIT_TO_TYPE,
    DerivedMetricParseException,
    MetricDoesNotExistException,
    MetricEntity,
    MetricOperationType,
    MetricType,
    NotSupportedOverCompositeEntityException,
    OrderByNotSupportedOverCompositeEntityException,
    combine_dictionary_of_list_values,
)
from sentry.utils.snuba import raw_snql_query

if typing.TYPE_CHECKING:
    from sentry.snuba.metrics.query import MetricsQuery

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
)

SnubaDataType = Dict[str, Any]
PostQueryFuncReturnType = Optional[Union[Tuple[Any, ...], ClickhouseHistogram, int, float]]


def run_metrics_query(
    *,
    entity_key: EntityKey,
    select: List[Column],
    where: List[Condition],
    groupby: List[Column],
    projects: Sequence[Project],
    org_id: int,
    referrer: str,
) -> List[SnubaDataType]:
    # Round timestamp to minute to get cache efficiency:
    now = datetime.now().replace(second=0, microsecond=0)

    query = Query(
        match=Entity(entity_key.value),
        select=select,
        groupby=groupby,
        where=[
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, [p.id for p in projects]),
            Condition(Column(TS_COL_QUERY), Op.GTE, now - timedelta(hours=24)),
            Condition(Column(TS_COL_QUERY), Op.LT, now),
        ]
        + where,
        granularity=Granularity(GRANULARITY),
    )
    request = Request(dataset=Dataset.Metrics.value, app_id="metrics", query=query)
    result = raw_snql_query(request, referrer, use_cache=True)
    return cast(List[SnubaDataType], result["data"])


def _get_known_entity_of_metric_mri(metric_mri: str) -> Optional[EntityKey]:
    for KnownMRI in (SessionMRI, TransactionMRI):
        try:
            KnownMRI(metric_mri)
            entity_prefix = metric_mri.split(":")[0]
            return {
                "c": EntityKey.MetricsCounters,
                "d": EntityKey.MetricsDistributions,
                "s": EntityKey.MetricsSets,
            }[entity_prefix]
        except (ValueError, IndexError, KeyError):
            pass
    return None


def _get_entity_of_metric_mri(projects: Sequence[Project], metric_mri: str) -> EntityKey:
    known_entity = _get_known_entity_of_metric_mri(metric_mri)
    if known_entity is not None:
        return known_entity

    assert projects
    org_id = org_id_from_projects(projects)
    metric_id = indexer.resolve(org_id, metric_mri)

    if metric_id is None:
        raise InvalidParams

    for metric_type in ("counter", "set", "distribution"):
        entity_key = METRIC_TYPE_TO_ENTITY[metric_type]
        data = run_metrics_query(
            entity_key=entity_key,
            select=[Column("metric_id")],
            where=[Condition(Column("metric_id"), Op.EQ, metric_id)],
            groupby=[Column("metric_id")],
            referrer="snuba.metrics.meta.get_entity_of_metric",
            projects=projects,
            org_id=org_id,
        )
        if data:
            return entity_key

    raise InvalidParams(f"Raw metric {get_public_name_from_mri(metric_mri)} does not exit")


def org_id_from_projects(projects: Sequence[Project]) -> int:
    assert len({p.organization_id for p in projects}) == 1
    return cast(int, projects[0].organization_id)


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
    def generate_filter_snql_conditions(self, org_id: int) -> Function:
        raise NotImplementedError

    @abstractmethod
    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[int]:
        raise NotImplementedError


class RawMetric(MetricObject):
    """
    Represents a class where the metric object just encapsulates a string name identifier for a
    metric
    """

    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[int]:
        return {resolve_weak(org_id_from_projects(projects), self.metric_mri)}

    def generate_filter_snql_conditions(self, org_id: int) -> Function:
        return Function("equals", [Column("metric_id"), resolve_weak(org_id, self.metric_mri)])


class AliasedDerivedMetric(AliasedDerivedMetricDefinition, MetricObject):
    """
    Represents a class where metric object is a class that encapsulates filter logic on an alias
    for a raw metric name
    """

    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[int]:
        return {resolve_weak(org_id_from_projects(projects), self.raw_metric_mri)}

    def generate_filter_snql_conditions(self, org_id: int) -> Function:
        conditions = [
            Function("equals", [Column("metric_id"), resolve_weak(org_id, self.raw_metric_mri)])
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
    def run_post_query_function(
        self,
        data: SnubaDataType,
        metrics_query: MetricsQuery,
        metric_mri: str,
        idx: Optional[int] = None,
    ) -> SnubaDataType:
        raise NotImplementedError

    @abstractmethod
    def generate_filter_snql_conditions(
        self, org_id: int, metrics_query: MetricsQuery
    ) -> Optional[Function]:
        raise NotImplementedError


@dataclass
class DerivedOpDefinition(MetricOperationDefinition):
    can_orderby: bool
    metrics_query_args: Optional[List[str]] = None
    post_query_func: Callable[..., PostQueryFuncReturnType] = lambda *args: args
    filter_conditions_func: Callable[..., Optional[Function]] = lambda _: None


class RawOp(MetricOperation):
    def validate_can_orderby(self) -> None:
        return

    def run_post_query_function(
        self,
        data: SnubaDataType,
        metrics_query: MetricsQuery,
        metric_mri: str,
        idx: Optional[int] = None,
    ) -> SnubaDataType:
        return data

    def generate_filter_snql_conditions(self, org_id: int, metrics_query: MetricsQuery) -> None:
        return


class DerivedOp(DerivedOpDefinition, MetricOperation):
    def validate_can_orderby(self) -> None:
        if not self.can_orderby:
            raise DerivedMetricParseException(
                f"Operation {self.op} cannot be used to order a query"
            )

    def run_post_query_function(
        self,
        data: SnubaDataType,
        metrics_query: MetricsQuery,
        metric_mri: str,
        idx: Optional[int] = None,
    ) -> SnubaDataType:
        key = f"{self.op}({metric_mri})"
        if idx is None:
            subdata = data[key]
        else:
            subdata = data[key][idx]

        compute_func_dict = {"data": subdata}
        if self.metrics_query_args is not None:
            for field in self.metrics_query_args:
                compute_func_dict[field] = getattr(metrics_query, field)

        subdata = self.post_query_func(**compute_func_dict)

        if idx is None:
            data[key] = subdata
        else:
            data[key][idx] = subdata
        return data

    def generate_filter_snql_conditions(
        self, org_id: int, metrics_query: MetricsQuery
    ) -> Optional[Function]:
        kwargs = {"org_id": org_id}
        if self.metrics_query_args is not None:
            for field in self.metrics_query_args:
                kwargs[field] = getattr(metrics_query, field)

        return self.filter_conditions_func(**kwargs)


class MetricExpressionBase(ABC):
    @abstractmethod
    def get_entity(
        self, projects: Sequence[Project]
    ) -> Union[MetricEntity, Dict[MetricEntity, Sequence[str]]]:
        """
        Method that generates the entity of an instance of MetricsFieldBase.
        `entity` property will always be None for instances of DerivedMetric that rely on
        constituent metrics that span multiple entities.
        """
        raise NotImplementedError

    @abstractmethod
    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[int]:
        """
        Method that generates all the metric ids required to query an instance of
        MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_select_statements(
        self, projects: Sequence[Project], metrics_query: MetricsQuery
    ) -> List[Function]:
        """
        Method that generates a list of SnQL functions required to query an instance of
        MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_orderby_clause(
        self, direction: Direction, projects: Sequence[Project], metrics_query: MetricsQuery
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
        self, data: SnubaDataType, metrics_query: MetricsQuery, idx: Optional[int] = None
    ) -> Any:
        """
        Method that runs functions on the values returned from the query
        """
        raise NotImplementedError

    @abstractmethod
    def generate_bottom_up_derived_metrics_dependencies(
        self,
    ) -> Iterable[Tuple[Optional[MetricOperation], str]]:
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

    def get_entity(self, projects: Sequence[Project]) -> MetricEntity:
        return OPERATIONS_TO_ENTITY[self.metric_operation.op]

    def generate_select_statements(
        self, projects: Sequence[Project], metrics_query: MetricsQuery
    ) -> List[Function]:
        org_id = org_id_from_projects(projects)
        return [
            self.build_conditional_aggregate_for_metric(
                org_id, entity=self.get_entity(projects), metrics_query=metrics_query
            )
        ]

    def generate_orderby_clause(
        self, direction: Direction, projects: Sequence[Project], metrics_query: MetricsQuery
    ) -> List[OrderBy]:
        self.metric_operation.validate_can_orderby()
        return [
            OrderBy(
                self.generate_select_statements(projects, metrics_query=metrics_query)[0],
                direction,
            )
        ]

    def generate_available_operations(self) -> Collection[MetricOperationType]:
        return []

    def generate_default_null_values(self) -> Optional[Union[int, List[Tuple[float]]]]:
        return cast(
            Optional[Union[int, List[Tuple[float]]]],
            copy.copy(DEFAULT_AGGREGATES[self.metric_operation.op]),
        )

    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[int]:
        return self.metric_object.generate_metric_ids(projects)

    def run_post_query_function(
        self, data: SnubaDataType, metrics_query: MetricsQuery, idx: Optional[int] = None
    ) -> Any:
        key = f"{self.metric_operation.op}({self.metric_object.metric_mri})"
        data = self.metric_operation.run_post_query_function(
            data, metrics_query, self.metric_object.metric_mri, idx
        )
        return data[key][idx] if idx is not None else data[key]

    def generate_bottom_up_derived_metrics_dependencies(
        self,
    ) -> Iterable[Tuple[MetricOperationType, str]]:
        return [(self.metric_operation.op, self.metric_object.metric_mri)]

    def build_conditional_aggregate_for_metric(
        self, org_id: int, entity: MetricEntity, metrics_query: MetricsQuery
    ) -> Function:
        snuba_function = OP_TO_SNUBA_FUNCTION[entity][self.metric_operation.op]
        conditions = self.metric_object.generate_filter_snql_conditions(org_id=org_id)

        operation_based_filter = self.metric_operation.generate_filter_snql_conditions(
            org_id=org_id, metrics_query=metrics_query
        )
        if operation_based_filter is not None:
            conditions = Function("and", [conditions, operation_based_filter])

        return Function(
            snuba_function,
            [Column("value"), conditions],
            alias=f"{self.metric_operation.op}({self.metric_object.metric_mri})",
        )


@dataclass
class DerivedMetricExpressionDefinition:
    metric_mri: str
    metrics: List[str]
    unit: str
    op: Optional[str] = None
    result_type: Optional[MetricType] = None
    # TODO: better typing
    # snql attribute is a function that takes optional args that map to strings that are MRIs for
    # the derived metric, org_id, metric_ids required to generate the snql and a string alias,
    # and in return, return snql that snuba can understand and represents how to query for the
    # derived metric
    snql: Optional[Callable[..., Function]] = None
    post_query_func: Any = lambda *args: args
    is_private: bool = False


class DerivedMetricExpression(DerivedMetricExpressionDefinition, MetricExpressionBase, ABC):
    def _raise_entity_validation_exception(self, func_name: str) -> None:
        raise DerivedMetricParseException(
            f"Method `{func_name}` can only be called on instance of "
            f"{self.__class__.__name__} "
            f"{get_public_name_from_mri(self.metric_mri)} with a `projects` attribute."
        )


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

    @classmethod
    def __recursively_get_all_entities_in_derived_metric_dependency_tree(
        cls, derived_metric_mri: str, projects: Sequence[Project]
    ) -> Set[MetricEntity]:
        """
        Method that gets the entity of a derived metric by traversing down its dependency tree
        until it gets to the raw metrics (leaf nodes) then queries snuba to check which
        entity/entities these raw constituent metrics belong to.
        """
        if derived_metric_mri not in DERIVED_METRICS:
            return {_get_entity_of_metric_mri(projects, derived_metric_mri).value}

        entities = set()
        derived_metric = DERIVED_METRICS[derived_metric_mri]

        for metric_mri in derived_metric.metrics:
            entities |= cls.__recursively_get_all_entities_in_derived_metric_dependency_tree(
                metric_mri, projects
            )
        return entities

    def get_entity(self, projects: Sequence[Project]) -> MetricEntity:
        if not projects:
            self._raise_entity_validation_exception("get_entity")
        try:
            entities = self.__recursively_get_all_entities_in_derived_metric_dependency_tree(
                derived_metric_mri=self.metric_mri, projects=projects
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
    def __recursively_generate_metric_ids(cls, org_id: int, derived_metric_mri: str) -> Set[int]:
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
                ids.add(resolve_weak(org_id, metric_mri))
            else:
                ids |= cls.__recursively_generate_metric_ids(org_id, metric_mri)
        return ids

    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[int]:
        org_id = org_id_from_projects(projects)
        return self.__recursively_generate_metric_ids(org_id, derived_metric_mri=self.metric_mri)

    @classmethod
    def __recursively_generate_select_snql(
        cls, org_id: int, derived_metric_mri: str
    ) -> List[Function]:
        """
        Method that generates the SnQL representation for the derived metric
        """
        if derived_metric_mri not in DERIVED_METRICS:
            return []
        derived_metric = DERIVED_METRICS[derived_metric_mri]
        arg_snql = []
        for arg in derived_metric.metrics:
            arg_snql += cls.__recursively_generate_select_snql(org_id, arg)
        assert derived_metric.snql is not None
        return [
            derived_metric.snql(
                *arg_snql,
                org_id=org_id,
                metric_ids=cls.__recursively_generate_metric_ids(org_id, derived_metric_mri),
                alias=derived_metric_mri,
            )
        ]

    def generate_select_statements(
        self, projects: Sequence[Project], metrics_query: MetricsQuery
    ) -> List[Function]:
        # Before, we are able to generate the relevant SnQL for a derived metric, we need to
        # validate that this instance of SingularEntityDerivedMetric is built from constituent
        # metrics that span a single entity
        if not projects:
            self._raise_entity_validation_exception("generate_select_statements")
        self.get_entity(projects=projects)
        org_id = org_id_from_projects(projects)
        return self.__recursively_generate_select_snql(org_id, derived_metric_mri=self.metric_mri)

    def generate_orderby_clause(
        self, direction: Direction, projects: Sequence[Project], metrics_query: MetricsQuery
    ) -> List[OrderBy]:
        if not projects:
            self._raise_entity_validation_exception("generate_orderby_clause")
        self.get_entity(projects=projects)
        return [
            OrderBy(
                self.generate_select_statements(projects=projects, metrics_query=metrics_query)[0],
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
        self, data: SnubaDataType, metrics_query: MetricsQuery, idx: Optional[int] = None
    ) -> Any:
        try:
            compute_func_args = [
                data[self.metric_mri] if idx is None else data[self.metric_mri][idx]
            ]
        except KeyError:
            compute_func_args = [self.generate_default_null_values()]
        result = self.post_query_func(*compute_func_args)
        if isinstance(result, tuple) and len(result) == 1:
            result = result[0]
        return result

    def generate_bottom_up_derived_metrics_dependencies(
        self,
    ) -> Iterable[Tuple[Optional[MetricOperationType], str]]:
        return [(None, self.metric_mri)]


class CompositeEntityDerivedMetric(DerivedMetricExpression):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.result_type = "numeric"

    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[Any]:
        raise NotSupportedOverCompositeEntityException()

    def generate_select_statements(
        self, projects: Sequence[Project], metrics_query: MetricsQuery
    ) -> List[Function]:
        raise NotSupportedOverCompositeEntityException()

    def generate_orderby_clause(
        self,
        direction: Direction,
        projects: Sequence[Project],
        metrics_query: MetricsQuery,
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

    def get_entity(self, projects: Sequence[Project]) -> Dict[MetricEntity, List[str]]:
        if not projects:
            self._raise_entity_validation_exception("get_entity")
        return self.__recursively_generate_singular_entity_constituents(
            projects=projects, derived_metric_obj=self
        )

    def generate_available_operations(self) -> Collection[MetricOperation]:
        return []

    @classmethod
    def __recursively_generate_singular_entity_constituents(
        cls,
        projects: Optional[Sequence[Project]],
        derived_metric_obj: DerivedMetricExpression,
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
                    entity = constituent_metric_obj.get_entity(projects=projects)

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
                    projects, constituent_metric_obj, is_naive
                ),
            )

        return entities_and_metric_mris

    def generate_bottom_up_derived_metrics_dependencies(
        self,
    ) -> Iterable[Tuple[Optional[MetricOperationType], str]]:
        # We are only interested in the dependency tree from instances of
        # CompositeEntityDerivedMetric as they don't have a direct mapping to SnQL and so
        # need to be computed post query which is practically when this function is called
        from collections import deque

        metric_nodes: Deque[DerivedMetricExpression] = deque()

        results = []
        metric_nodes.append(self)
        while metric_nodes:
            node = metric_nodes.popleft()
            if node.metric_mri in DERIVED_METRICS:
                results.append((None, node.metric_mri))
                # We do not really care about getting the components of an instance of
                # SingularEntityDerivedMetric because there is a direct mapping to the response
                # returned by the dataset anyways
                if isinstance(node, SingularEntityDerivedMetric):
                    continue
            for metric in node.metrics:
                if metric in DERIVED_METRICS:
                    metric_nodes.append(DERIVED_METRICS[metric])
        return reversed(results)

    def naively_generate_singular_entity_constituents(self) -> Set[str]:
        single_entity_constituents = set(
            list(
                self.__recursively_generate_singular_entity_constituents(
                    projects=None, derived_metric_obj=self, is_naive=True
                ).values()
            ).pop()
        )
        return single_entity_constituents

    def run_post_query_function(
        self, data: SnubaDataType, metrics_query: MetricsQuery, idx: Optional[int] = None
    ) -> Any:
        compute_func_args = [
            data[constituent_metric_mri] if idx is None else data[constituent_metric_mri][idx]
            for constituent_metric_mri in self.metrics
        ]
        return self.post_query_func(*compute_func_args)


# ToDo(ahmed): Investigate dealing with derived metric keys as Enum objects rather than string
#  values
DERIVED_METRICS: Mapping[str, DerivedMetricExpression] = {
    derived_metric.metric_mri: derived_metric
    for derived_metric in [
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ALL.value,
            metrics=[SessionMRI.SESSION.value],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: all_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ALL_USER.value,
            metrics=[SessionMRI.USER.value],
            unit="users",
            snql=lambda *_, org_id, metric_ids, alias=None: all_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ABNORMAL.value,
            metrics=[SessionMRI.SESSION.value],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: abnormal_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ABNORMAL_USER.value,
            metrics=[SessionMRI.USER.value],
            unit="users",
            snql=lambda *_, org_id, metric_ids, alias=None: abnormal_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED.value,
            metrics=[SessionMRI.SESSION.value],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: crashed_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED_USER.value,
            metrics=[SessionMRI.USER.value],
            unit="users",
            snql=lambda *_, org_id, metric_ids, alias=None: crashed_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_RATE.value,
            metrics=[SessionMRI.CRASHED.value, SessionMRI.ALL.value],
            unit="percentage",
            snql=lambda *args, org_id, metric_ids, alias=None: division_float(*args, alias=alias),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_USER_RATE.value,
            metrics=[
                SessionMRI.CRASHED_USER.value,
                SessionMRI.ALL_USER.value,
            ],
            unit="percentage",
            snql=lambda *args, org_id, metric_ids, alias=None: division_float(*args, alias=alias),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE_RATE.value,
            metrics=[SessionMRI.CRASH_RATE.value],
            unit="percentage",
            snql=lambda *args, org_id, metric_ids, alias=None: complement(*args, alias=alias),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASH_FREE_USER_RATE.value,
            metrics=[SessionMRI.CRASH_USER_RATE.value],
            unit="percentage",
            snql=lambda *args, org_id, metric_ids, alias=None: complement(*args, alias=alias),
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_PREAGGREGATED.value,
            metrics=[SessionMRI.SESSION.value],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: errored_preaggr_sessions(
                org_id, metric_ids, alias=alias
            ),
            is_private=True,
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_SET.value,
            metrics=[SessionMRI.ERROR.value],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: uniq_aggregation_on_metric(
                metric_ids, alias=alias
            ),
            is_private=True,
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED_AND_ABNORMAL.value,
            metrics=[
                SessionMRI.CRASHED.value,
                SessionMRI.ABNORMAL.value,
            ],
            unit="sessions",
            snql=lambda *args, org_id, metric_ids, alias=None: addition(*args, alias=alias),
            is_private=True,
        ),
        CompositeEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_ALL.value,
            metrics=[
                SessionMRI.ERRORED_PREAGGREGATED.value,
                SessionMRI.ERRORED_SET.value,
            ],
            unit="sessions",
            post_query_func=lambda *args: sum([*args]),
            is_private=True,
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
            metrics=[SessionMRI.USER.value],
            unit="users",
            snql=lambda *_, org_id, metric_ids, alias=None: errored_all_users(
                org_id, metric_ids, alias=alias
            ),
            is_private=True,
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.CRASHED_AND_ABNORMAL_USER.value,
            metrics=[
                SessionMRI.CRASHED_USER.value,
                SessionMRI.ABNORMAL_USER.value,
            ],
            unit="users",
            snql=lambda *args, org_id, metric_ids, alias=None: addition(*args, alias=alias),
            is_private=True,
        ),
        SingularEntityDerivedMetric(
            metric_mri=SessionMRI.ERRORED_USER.value,
            metrics=[
                SessionMRI.ERRORED_USER_ALL.value,
                SessionMRI.CRASHED_AND_ABNORMAL_USER.value,
            ],
            unit="users",
            snql=lambda *args, org_id, metric_ids, alias=None: subtraction(*args, alias=alias),
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
            snql=lambda *args, org_id, metric_ids, alias=None: subtraction(*args, alias=alias),
            post_query_func=lambda *args: max(0, *args),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.ALL.value,
            metrics=[TransactionMRI.DURATION.value],
            unit="transactions",
            snql=lambda *_, org_id, metric_ids, alias=None: all_transactions(
                org_id, metric_ids=metric_ids, alias=alias
            ),
            is_private=True,
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.FAILURE_COUNT.value,
            metrics=[TransactionMRI.DURATION.value],
            unit="transactions",
            snql=lambda *_, org_id, metric_ids, alias=None: failure_count_transaction(
                org_id, metric_ids=metric_ids, alias=alias
            ),
            is_private=True,
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.FAILURE_RATE.value,
            metrics=[
                TransactionMRI.FAILURE_COUNT.value,
                TransactionMRI.ALL.value,
            ],
            unit="transactions",
            snql=lambda failure_count, tx_count, org_id, metric_ids, alias=None: division_float(
                failure_count, tx_count, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.SATISFIED.value,
            metrics=[TransactionMRI.DURATION.value],
            unit="transactions",
            snql=lambda *_, org_id, metric_ids, alias=None: satisfaction_count_transaction(
                org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
            is_private=True,
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.TOLERATED.value,
            metrics=[TransactionMRI.DURATION.value],
            unit="transactions",
            snql=lambda *_, org_id, metric_ids, alias=None: tolerated_count_transaction(
                org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
            is_private=True,
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.APDEX.value,
            metrics=[
                TransactionMRI.SATISFIED.value,
                TransactionMRI.TOLERATED.value,
                TransactionMRI.ALL.value,
            ],
            unit="percentage",
            snql=lambda satisfied, tolerated, total, org_id, metric_ids, alias=None: apdex(
                satisfied, tolerated, total, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.MISERABLE_USER.value,
            metrics=[
                TransactionMRI.USER.value,
            ],
            unit="users",
            snql=lambda *_, org_id, metric_ids, alias=None: miserable_users(
                org_id=org_id, metric_ids=metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.ALL_USER.value,
            metrics=[TransactionMRI.USER.value],
            unit="percentage",
            snql=lambda *_, org_id, metric_ids, alias=None: uniq_aggregation_on_metric(
                metric_ids, alias=alias
            ),
            is_private=True,
        ),
        SingularEntityDerivedMetric(
            metric_mri=TransactionMRI.USER_MISERY.value,
            metrics=[TransactionMRI.MISERABLE_USER.value, TransactionMRI.ALL_USER.value],
            unit="percentage",
            snql=lambda miserable_user, user, org_id, metric_ids, alias=None: division_float(
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
            metrics_query_args=["histogram_from", "histogram_to", "histogram_buckets"],
            post_query_func=rebucket_histogram,
            filter_conditions_func=zoom_histogram,
        )
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
    derived_metrics = get_derived_metrics(exclude_private=False)
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
    metrics_query_fields_set: Set[Tuple[Optional[MetricOperationType], str]]
) -> List[Tuple[Optional[MetricOperationType], str]]:
    """
    This function basically generates a dependency list for all instances of
    `CompositeEntityDerivedMetric` in a query definition fields set
    """
    dependency_list: List[Tuple[Optional[MetricOperation], str]] = []
    for op, metric_mri in metrics_query_fields_set:
        dependency_list.extend(
            metric_object_factory(op, metric_mri).generate_bottom_up_derived_metrics_dependencies()
        )
    return dependency_list


def get_derived_metrics(exclude_private: bool = True) -> Mapping[str, DerivedMetricExpression]:
    # ToDo(ahmed): Modify the behaviour here to determine whether a metric is private or not
    #  based on whether it is added to the public naming layer or not
    return (
        {key: value for (key, value) in DERIVED_METRICS.items() if not value.is_private}
        if exclude_private
        else DERIVED_METRICS
    )
