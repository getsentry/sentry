__all__ = (
    "metric_object_factory",
    "run_metrics_query",
    "get_single_metric_info",
    "RawMetric",
    "MetricsFieldBase",
    "RawMetric",
)

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from functools import cached_property
from operator import itemgetter
from typing import Any, List, Mapping, Sequence

from snuba_sdk import Column, Condition, Entity, Function, Granularity, Op, Query
from snuba_sdk.orderby import OrderBy

from sentry.api.utils import InvalidParams
from sentry.models import Project
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.utils import resolve_weak, reverse_resolve
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.utils import (
    AVAILABLE_OPERATIONS,
    GRANULARITY,
    METRIC_TYPE_TO_ENTITY,
    OP_TO_SNUBA_FUNCTION,
    OPERATIONS_TO_ENTITY,
    TS_COL_QUERY,
    MetricMetaWithTagKeys,
)
from sentry.utils.snuba import raw_snql_query


def metric_object_factory(op, metric_name):
    """Returns an appropriate instance of MetricFieldBase object"""
    return RawMetric(op, metric_name)


def run_metrics_query(
    *,
    entity_key: EntityKey,
    select: List[Column],
    where: List[Condition],
    groupby: List[Column],
    projects,
    org_id,
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


def get_single_metric_info(projects: Sequence[Project], metric_name: str) -> MetricMetaWithTagKeys:
    assert projects

    metric_id = indexer.resolve(metric_name)

    if metric_id is None:
        raise InvalidParams

    for metric_type in ("counter", "set", "distribution"):
        # TODO: What if metric_id exists for multiple types / units?
        entity_key = METRIC_TYPE_TO_ENTITY[metric_type]
        data = run_metrics_query(
            entity_key=entity_key,
            select=[Column("metric_id"), Column("tags.key")],
            where=[Condition(Column("metric_id"), Op.EQ, metric_id)],
            groupby=[Column("metric_id"), Column("tags.key")],
            referrer="snuba.metrics.meta.get_single_metric",
            projects=projects,
            org_id=projects[0].organization_id,
        )
        if data:
            tag_ids = {tag_id for row in data for tag_id in row["tags.key"]}
            return {
                "name": metric_name,
                "type": metric_type,
                "operations": AVAILABLE_OPERATIONS[entity_key.value],
                "tags": sorted(
                    ({"key": reverse_resolve(tag_id)} for tag_id in tag_ids),
                    key=itemgetter("key"),
                ),
                "unit": None,
            }

    raise InvalidParams


class MetricsFieldBase(ABC):
    def __init__(self, op, metric_name):
        self.op = op
        self.metric_name = metric_name

    @abstractmethod
    def get_entity(self, **kwargs):
        raise NotImplementedError

    @abstractmethod
    def generate_metric_ids(self, *args):
        raise NotImplementedError

    @abstractmethod
    def generate_select_statements(self, **kwargs):
        raise NotImplementedError

    @abstractmethod
    def generate_orderby_clause(self, **kwargs):
        raise NotImplementedError


class RawMetric(MetricsFieldBase):
    def get_entity(self, **kwargs):
        return OPERATIONS_TO_ENTITY[self.op]

    def generate_metric_ids(self, entity, *args):
        return (
            {resolve_weak(self.metric_name)} if OPERATIONS_TO_ENTITY[self.op] == entity else set()
        )

    def _build_conditional_aggregate_for_metric(self, entity):
        snuba_function = OP_TO_SNUBA_FUNCTION[entity][self.op]
        return Function(
            snuba_function,
            [
                Column("value"),
                Function("equals", [Column("metric_id"), resolve_weak(self.metric_name)]),
            ],
            alias=f"{self.op}({self.metric_name})",
        )

    def generate_select_statements(self, entity, **kwargs):
        return [self._build_conditional_aggregate_for_metric(entity=entity)]

    def generate_orderby_clause(self, entity, direction, **kwargs):
        return [
            OrderBy(
                self.generate_select_statements(entity=entity)[0],
                direction,
            )
        ]

    entity = cached_property(get_entity)
