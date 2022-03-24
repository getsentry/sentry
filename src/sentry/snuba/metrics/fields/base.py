__all__ = (
    "metric_object_factory",
    "run_metrics_query",
    "RawAggregatedMetric",
    "MetricFieldBase",
    "DerivedMetric",
    "SingularEntityDerivedMetric",
    "DERIVED_METRICS",
    "generate_bottom_up_dependency_tree_for_metrics",
)

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional, Sequence, Set, Union

from snuba_sdk import Column, Condition, Entity, Function, Granularity, Op, Query
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.utils import InvalidParams
from sentry.models import Project, dataclass
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.fields.snql import (
    abnormal_sessions,
    all_sessions,
    all_users,
    crashed_sessions,
    crashed_users,
    errored_preaggr_sessions,
    percentage,
    sessions_errored_set,
)
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
    MetricType,
    NotSupportedOverCompositeEntityException,
)
from sentry.utils.snuba import raw_snql_query


def run_metrics_query(
    *,
    entity_key: EntityKey,
    select: List[Column],
    where: List[Condition],
    groupby: List[Column],
    projects: Sequence[Project],
    org_id: int,
    referrer: str,
) -> Mapping[str, Any]:
    # Round timestamp to minute to get cache efficiency:
    now = datetime.now().replace(second=0, microsecond=0)

    query = Query(
        dataset=Dataset.Metrics.value,
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
    result = raw_snql_query(query, referrer, use_cache=True)
    return result["data"]


def _get_entity_of_metric_name(projects: Sequence[Project], metric_name: str) -> EntityKey:
    assert projects
    org_id = org_id_from_projects(projects)
    metric_id = indexer.resolve(org_id, metric_name)

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

    raise InvalidParams(f"Raw metric {metric_name} does not exit")


def org_id_from_projects(projects: Sequence[Project]) -> int:
    assert len({p.organization_id for p in projects}) == 1
    return projects[0].organization_id


@dataclass
class MetricFieldBaseDefinition:
    op: str
    metric_name: str


class MetricFieldBase(MetricFieldBaseDefinition, ABC):
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
    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[Any]:
        """
        Method that generates all the metric ids required to query an instance of
        MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_select_statements(self, projects: Sequence[Project]) -> List[Function]:
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
    ) -> List[OrderBy]:
        """
        Method that generates a list of SnQL OrderBy clauses based on an instance of
        MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_default_null_values(self):
        """
        Method that generates the appropriate default value for an instance of MetricsFieldBase
        """
        raise NotImplementedError

    @abstractmethod
    def generate_available_operations(self):
        """
        Method that generate the available operations for an instance of DerivedMetric
        """
        raise NotImplementedError

    @abstractmethod
    def run_post_query_function(self, data, idx=None):
        """
        Method that runs functions on the values returned from the query
        """
        raise NotImplementedError


class RawAggregatedMetric(MetricFieldBase):
    """
    This class serves the purpose of representing any aggregate, raw metric combination for
    example `sum(sentry.sessions.session)`. It is created on the fly to abstract the field
    conversions to SnQL away from the query builder.
    """

    def get_entity(self, **kwargs: Any) -> MetricEntity:
        # ToDo(ahmed): For raw metrics, we need to step away from determining the entity from the
        #  op, and should rather do so dynamically with respect to the projects filter
        return OPERATIONS_TO_ENTITY[self.op]

    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[int]:
        return {resolve_weak(org_id_from_projects(projects), self.metric_name)}

    def __build_conditional_aggregate_for_metric(
        self, org_id: int, entity: MetricEntity
    ) -> Function:
        snuba_function = OP_TO_SNUBA_FUNCTION[entity][self.op]
        return Function(
            snuba_function,
            [
                Column("value"),
                Function("equals", [Column("metric_id"), resolve_weak(org_id, self.metric_name)]),
            ],
            alias=f"{self.op}({self.metric_name})",
        )

    def generate_select_statements(self, projects: Sequence[Project]) -> List[Function]:
        org_id = org_id_from_projects(projects)
        return [self.__build_conditional_aggregate_for_metric(org_id, entity=self.get_entity())]

    def generate_orderby_clause(
        self, direction: Direction, projects: Sequence[Project]
    ) -> List[OrderBy]:
        return [
            OrderBy(
                self.generate_select_statements(projects)[0],
                direction,
            )
        ]

    def generate_available_operations(self):
        return []

    def generate_default_null_values(self):
        return DEFAULT_AGGREGATES[self.op]

    def run_post_query_function(self, data, idx=None):
        key = f"{self.op}({self.metric_name})"
        return data[key][idx] if idx is not None else data[key]


@dataclass
class DerivedMetricDefinition:
    metric_name: str
    metrics: List[str]
    unit: str
    op: Optional[str] = None
    result_type: Optional[MetricType] = None
    snql: Optional[Function] = None
    post_query_func: Any = lambda *args: args
    is_private: bool = False


class DerivedMetric(DerivedMetricDefinition, MetricFieldBase, ABC):
    def _raise_entity_validation_exception(self, func_name: str):
        raise DerivedMetricParseException(
            f"Method `{func_name}` can only be called on instance of "
            f"{self.__class__.__name__} {self.metric_name} with a `projects` attribute."
        )


class SingularEntityDerivedMetric(DerivedMetric):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)  # type: ignore
        self.result_type = "numeric"

        if self.snql is None:
            raise DerivedMetricParseException(
                "SnQL cannot be None for instances of SingularEntityDerivedMetric"
            )

    @classmethod
    def __recursively_get_all_entities_in_derived_metric_dependency_tree(
        cls, derived_metric_name: str, projects: Sequence[Project]
    ) -> Set[MetricEntity]:
        """
        Method that gets the entity of a derived metric by traversing down its dependency tree
        until it gets to the raw metrics (leaf nodes) then queries snuba to check which
        entity/entities these raw constituent metrics belong to.
        """
        if derived_metric_name not in DERIVED_METRICS:
            return {_get_entity_of_metric_name(projects, derived_metric_name).value}

        entities = set()
        derived_metric = DERIVED_METRICS[derived_metric_name]

        for metric_name in derived_metric.metrics:
            entities |= cls.__recursively_get_all_entities_in_derived_metric_dependency_tree(
                metric_name, projects
            )
        return entities

    def get_entity(self, projects: Sequence[Project]) -> MetricEntity:
        if not projects:
            self._raise_entity_validation_exception("get_entity")
        try:
            entities = self.__recursively_get_all_entities_in_derived_metric_dependency_tree(
                derived_metric_name=self.metric_name, projects=projects
            )
        except InvalidParams:
            raise MetricDoesNotExistException()
        if len(entities) != 1 or entities == {None}:
            raise DerivedMetricParseException(
                f"Derived Metric {self.metric_name} cannot be calculated from a single entity"
            )
        return entities.pop()

    @classmethod
    def __recursively_generate_metric_ids(cls, org_id: int, derived_metric_name: str) -> Set[int]:
        """
        Method that traverses a derived metric dependency tree to return a set of the metric ids
        of its constituent metrics
        """
        if derived_metric_name not in DERIVED_METRICS:
            return set()
        derived_metric = DERIVED_METRICS[derived_metric_name]
        ids = set()
        for metric_name in derived_metric.metrics:
            if metric_name not in DERIVED_METRICS:
                ids.add(resolve_weak(org_id, metric_name))
            else:
                ids |= cls.__recursively_generate_metric_ids(org_id, metric_name)
        return ids

    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[int]:
        org_id = org_id_from_projects(projects)
        return self.__recursively_generate_metric_ids(org_id, derived_metric_name=self.metric_name)

    @classmethod
    def __recursively_generate_select_snql(
        cls, org_id: int, derived_metric_name: str
    ) -> List[Function]:
        """
        Method that generates the SnQL representation for the derived metric
        """
        if derived_metric_name not in DERIVED_METRICS:
            return []
        derived_metric = DERIVED_METRICS[derived_metric_name]
        arg_snql = []
        for arg in derived_metric.metrics:
            arg_snql += cls.__recursively_generate_select_snql(org_id, arg)
        return [
            derived_metric.snql(
                *arg_snql,
                org_id=org_id,
                metric_ids=cls.__recursively_generate_metric_ids(org_id, derived_metric_name),
                alias=derived_metric_name,
            )
        ]

    def generate_select_statements(self, projects: Sequence[Project]) -> List[Function]:
        # Before, we are able to generate the relevant SnQL for a derived metric, we need to
        # validate that this instance of SingularEntityDerivedMetric is built from constituent
        # metrics that span a single entity
        if not projects:
            self._raise_entity_validation_exception("generate_select_statements")
        self.get_entity(projects=projects)
        org_id = org_id_from_projects(projects)
        return self.__recursively_generate_select_snql(org_id, derived_metric_name=self.metric_name)

    def generate_orderby_clause(
        self, direction: Direction, projects: Sequence[Project]
    ) -> List[OrderBy]:
        if not projects:
            self._raise_entity_validation_exception("generate_orderby_clause")
        self.get_entity(projects=projects)
        return [
            OrderBy(
                self.generate_select_statements(projects=projects)[0],
                direction,
            )
        ]

    def generate_default_null_values(self):
        default_null_value = None
        try:
            default_null_value = DEFAULT_AGGREGATES[UNIT_TO_TYPE[self.unit]]
        except KeyError:
            pass
        return default_null_value

    def generate_available_operations(self):
        return []

    def run_post_query_function(self, data, idx=None):
        compute_func_args = [data[self.metric_name] if idx is None else data[self.metric_name][idx]]
        result = self.post_query_func(*compute_func_args)
        return result[0] if len(result) == 1 else result


class CompositeEntityDerivedMetric(DerivedMetric):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)  # type: ignore
        self.result_type = "numeric"

    def generate_metric_ids(self, projects: Sequence[Project]) -> Set[Any]:
        raise NotSupportedOverCompositeEntityException()

    def generate_select_statements(self, projects: Sequence[Project]) -> List[Function]:
        raise NotSupportedOverCompositeEntityException()

    def generate_orderby_clause(
        self, projects: Sequence[Project], direction: Direction
    ) -> List[OrderBy]:
        raise NotSupportedOverCompositeEntityException(
            f"It is not possible to orderBy field {self.metric_name} as it does not "
            f"have a direct mapping to a query alias"
        )

    def generate_default_null_values(self):
        default_null_value = None
        try:
            default_null_value = DEFAULT_AGGREGATES[UNIT_TO_TYPE[self.unit]]
        except KeyError:
            pass
        return default_null_value

    def get_entity(self, projects: Sequence[Project]) -> Dict[MetricEntity, Sequence[str]]:
        if not projects:
            self._raise_entity_validation_exception("get_entity")
        return self.__recursively_generate_singular_entity_constituents(projects, self)

    def generate_available_operations(self):
        return []

    @classmethod
    def __recursively_generate_singular_entity_constituents(cls, projects, derived_metric_obj):
        entities_and_metric_names = {}
        for metric_name in derived_metric_obj.metrics:
            if metric_name not in DERIVED_METRICS:
                continue
            constituent_metric_obj = DERIVED_METRICS[metric_name]
            if isinstance(constituent_metric_obj, SingularEntityDerivedMetric):
                entity = constituent_metric_obj.get_entity(projects=projects)
                entities_and_metric_names.setdefault(entity, []).append(
                    constituent_metric_obj.metric_name
                )
            entities_and_metric_names.update(
                cls.__recursively_generate_singular_entity_constituents(
                    projects, constituent_metric_obj
                )
            )

        return entities_and_metric_names

    def generate_bottom_up_derived_metrics_dependencies(self):
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
        from collections import deque

        metric_nodes = deque()

        results = []
        metric_nodes.append(self)
        while metric_nodes:
            node = metric_nodes.popleft()
            if node.metric_name in DERIVED_METRICS:
                results.append((None, node.metric_name))
            for metric in node.metrics:
                if metric in DERIVED_METRICS:
                    metric_nodes.append(DERIVED_METRICS[metric])
        return reversed(results)

    def run_post_query_function(self, data, idx=None):
        compute_func_args = [
            data[constituent_metric_name] if idx is None else data[constituent_metric_name][idx]
            for constituent_metric_name in self.metrics
        ]
        return self.post_query_func(*compute_func_args)


# ToDo(ahmed): Replace the metric_names with Enums
DERIVED_METRICS = {
    derived_metric.metric_name: derived_metric
    for derived_metric in [
        SingularEntityDerivedMetric(
            metric_name="session.all",
            metrics=["sentry.sessions.session"],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: all_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.abnormal",
            metrics=["sentry.sessions.session"],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: abnormal_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.crashed",
            metrics=["sentry.sessions.session"],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: crashed_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.crash_free_rate",
            metrics=["session.crashed", "session.all"],
            unit="percentage",
            snql=lambda *args, org_id, metric_ids, alias=None: percentage(
                org_id, *args, alias="session.crash_free_rate"
            ),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.errored_preaggregated",
            metrics=["sentry.sessions.session"],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: errored_preaggr_sessions(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.errored_set",
            metrics=["sentry.sessions.session.error"],
            unit="sessions",
            snql=lambda *_, org_id, metric_ids, alias=None: sessions_errored_set(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.all_user",
            metrics=["sentry.sessions.user"],
            unit="users",
            snql=lambda *_, org_id, metric_ids, alias=None: all_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.crashed_user",
            metrics=["sentry.sessions.user"],
            unit="users",
            snql=lambda *_, org_id, metric_ids, alias=None: crashed_users(
                org_id, metric_ids, alias=alias
            ),
        ),
        CompositeEntityDerivedMetric(
            metric_name="session.errored",
            metrics=["session.errored_preaggregated", "session.errored_set"],
            unit="sessions",
            post_query_func=lambda *args: sum([*args]),
        ),
    ]
}


def metric_object_factory(op: Optional[str], metric_name: str) -> MetricFieldBase:
    """Returns an appropriate instance of MetricsFieldBase object"""
    if metric_name in DERIVED_METRICS:
        instance = DERIVED_METRICS[metric_name]
    else:
        instance = RawAggregatedMetric(op=op, metric_name=metric_name)
    return instance


def generate_bottom_up_dependency_tree_for_metrics(query_definition_fields_set):
    """
    This function basically generates a dependency list for all instances of
    `CompositeEntityDerivedMetric` in a query definition fields set
    """
    dependency_list = []
    for op, field_name in query_definition_fields_set:
        if field_name not in DERIVED_METRICS:
            # Instances of RawAggregatedMetric do not have dependencies
            continue
        derived_metric = DERIVED_METRICS[field_name]
        # We are only interested in the dependency tree from instances of
        # CompositeEntityDerivedMetric as they don't have a direct mapping to SnQL and so
        # need to be computed post query which is practically when this function is called
        if isinstance(derived_metric, CompositeEntityDerivedMetric):
            dependency_list.extend(derived_metric.generate_bottom_up_derived_metrics_dependencies())
    return dependency_list
