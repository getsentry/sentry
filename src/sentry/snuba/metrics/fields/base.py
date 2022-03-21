__all__ = (
    "metric_object_factory",
    "run_metrics_query",
    "RawMetric",
    "MetricFieldBase",
    "RawMetric",
    "DerivedMetric",
    "SingularEntityDerivedMetric",
    "DERIVED_METRICS",
)

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, List, Mapping, Optional, Sequence, Set

from snuba_sdk import Column, Condition, Entity, Function, Granularity, Op, Query
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.utils import InvalidParams
from sentry.models import Project, dataclass
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.utils import resolve_weak
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.fields.snql import (
    crashed_sessions,
    errored_preaggr_sessions,
    init_sessions,
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

    metric_id = indexer.resolve(metric_name)

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
            org_id=projects[0].organization_id,
        )
        if data:
            return entity_key

    raise InvalidParams(f"Raw metric {metric_name} does not exit")


@dataclass
class MetricFieldBaseDefinition:
    op: str
    metric_name: str


class MetricFieldBase(MetricFieldBaseDefinition, ABC):
    @abstractmethod
    def get_entity(self, projects: Sequence[Project]) -> Optional[MetricEntity]:
        """
        Method that generates the entity of an instance of MetricsFieldBase.
        `entity` property will always be None for instances of DerivedMetric that rely on
        constituent metrics that span multiple entities.
        """
        raise NotImplementedError

    @abstractmethod
    def generate_metric_ids(self) -> Set[Any]:
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
        self, projects: Sequence[Project], direction: Direction
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


class RawMetric(MetricFieldBase):
    def get_entity(self, **kwargs: Any) -> MetricEntity:
        # ToDo(ahmed): For raw metrics, we need to step away from determining the entity from the
        #  op, and should rather do so dynamically with respect to the projects filter
        return OPERATIONS_TO_ENTITY[self.op]

    def generate_metric_ids(self) -> Set[int]:
        return {resolve_weak(self.metric_name)}

    def __build_conditional_aggregate_for_metric(self, entity: MetricEntity) -> Function:
        snuba_function = OP_TO_SNUBA_FUNCTION[entity][self.op]
        return Function(
            snuba_function,
            [
                Column("value"),
                Function("equals", [Column("metric_id"), resolve_weak(self.metric_name)]),
            ],
            alias=f"{self.op}({self.metric_name})",
        )

    def generate_select_statements(self, **kwargs: Any) -> List[Function]:
        return [self.__build_conditional_aggregate_for_metric(entity=self.get_entity())]

    def generate_orderby_clause(self, direction: Direction, **kwargs: Any) -> List[OrderBy]:
        return [
            OrderBy(
                self.generate_select_statements(entity=self.get_entity())[0],
                direction,
            )
        ]

    def generate_default_null_values(self):
        return DEFAULT_AGGREGATES[self.op]


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
    @abstractmethod
    def generate_available_operations(self):
        """
        Method that generate the available operations for an instance of DerivedMetric
        """
        raise NotImplementedError


class SingularEntityDerivedMetric(DerivedMetric):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)  # type: ignore
        self.result_type = "numeric"

    def __raise_entity_validation_exception(self, func_name: str):
        raise DerivedMetricParseException(
            f"Method `{func_name}` can only be called on instance of "
            f"SingularEntityDerivedMetric {self.metric_name} with a `projects` attribute."
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
            self.__raise_entity_validation_exception("get_entity")
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
    def __recursively_generate_metric_ids(cls, derived_metric_name: str) -> Set[int]:
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
                ids.add(resolve_weak(metric_name))
            else:
                ids |= cls.__recursively_generate_metric_ids(metric_name)
        return ids

    def generate_metric_ids(self) -> Set[int]:
        return self.__recursively_generate_metric_ids(derived_metric_name=self.metric_name)

    @classmethod
    def __recursively_generate_select_snql(cls, derived_metric_name: str) -> List[Function]:
        """
        Method that generates the SnQL representation for the derived metric
        """
        if derived_metric_name not in DERIVED_METRICS:
            return []
        derived_metric = DERIVED_METRICS[derived_metric_name]
        arg_snql = []
        for arg in derived_metric.metrics:
            arg_snql += cls.__recursively_generate_select_snql(arg)
        return [
            derived_metric.snql(
                *arg_snql,
                metric_ids=cls.__recursively_generate_metric_ids(derived_metric_name),
                alias=derived_metric_name,
            )
        ]

    def generate_select_statements(self, projects: Sequence[Project]) -> List[Function]:
        # Before, we are able to generate the relevant SnQL for a derived metric, we need to
        # validate that this instance of SingularEntityDerivedMetric is built from constituent
        # metrics that span a single entity
        if not projects:
            self.__raise_entity_validation_exception("generate_select_statements")
        self.get_entity(projects=projects)
        return self.__recursively_generate_select_snql(derived_metric_name=self.metric_name)

    def generate_orderby_clause(
        self, direction: Direction, projects: Sequence[Project]
    ) -> List[OrderBy]:
        if not projects:
            self.__raise_entity_validation_exception("generate_orderby_clause")
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


# ToDo(ahmed): Replace the metric_names with Enums
DERIVED_METRICS = {
    derived_metric.metric_name: derived_metric
    for derived_metric in [
        SingularEntityDerivedMetric(
            metric_name="session.init",
            metrics=["sentry.sessions.session"],
            unit="sessions",
            snql=lambda *_, metric_ids, alias=None: init_sessions(metric_ids, alias=alias),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.crashed",
            metrics=["sentry.sessions.session"],
            unit="sessions",
            snql=lambda *_, metric_ids, alias=None: crashed_sessions(metric_ids, alias=alias),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.crash_free_rate",
            metrics=["session.crashed", "session.init"],
            unit="percentage",
            snql=lambda *args, metric_ids, alias=None: percentage(
                *args, alias="session.crash_free_rate"
            ),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.errored_preaggregated",
            metrics=["sentry.sessions.session"],
            unit="sessions",
            snql=lambda *_, metric_ids, alias=None: errored_preaggr_sessions(
                metric_ids, alias=alias
            ),
        ),
        SingularEntityDerivedMetric(
            metric_name="session.errored_set",
            metrics=["sentry.sessions.session.error"],
            unit="sessions",
            snql=lambda *_, metric_ids, alias=None: sessions_errored_set(metric_ids, alias=alias),
        ),
    ]
}


def metric_object_factory(op: Optional[str], metric_name: str) -> MetricFieldBase:
    """Returns an appropriate instance of MetricsFieldBase object"""
    if metric_name in DERIVED_METRICS:
        instance = DERIVED_METRICS[metric_name]
    else:
        instance = RawMetric(op=op, metric_name=metric_name)
    return instance
