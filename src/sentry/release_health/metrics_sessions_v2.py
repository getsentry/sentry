""" This module offers the same functionality as sessions_v2, but pulls its data
from the `metrics` dataset instead of `sessions`.

Do not call this module directly. Use the `release_health` service instead. """
import logging
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass, replace
from typing import Any, List, MutableMapping, Optional, Sequence, TypedDict

from snuba_sdk import Condition, Granularity
from snuba_sdk.legacy import json_to_snql

from sentry.models.project import Project
from sentry.release_health.base import (
    SessionsQueryFunction,
    SessionsQueryResult,
    SessionsQueryValue,
)
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics.datasource import get_series
from sentry.snuba.metrics.naming_layer.public import SessionMetricKey
from sentry.snuba.metrics.query import MetricField
from sentry.snuba.sessions_v2 import QueryDefinition, finite_or_none, isoformat_z

logger = logging.getLogger(__name__)

GroupKeyDict = TypedDict(
    "GroupKeyDict",
    {"project": int, "release": str, "environment": str, "session.status": str},
    total=False,
)


@dataclass(frozen=True)
class GroupKey:
    """Hashable version of group key dict"""

    project: Optional[int] = None
    release: Optional[str] = None
    environment: Optional[str] = None
    session_status: Optional[str] = None

    @staticmethod
    def from_input_dict(dct: GroupKeyDict) -> "GroupKey":
        """Construct from a metrics group["by"] result"""
        return GroupKey(
            project=dct.get("project_id", None),
            release=dct.get("release", None),
            environment=dct.get("environment", None),
        )

    def to_output_dict(self) -> GroupKeyDict:
        dct: GroupKeyDict = {}
        if self.project:
            dct["project"] = self.project
        if self.release:
            dct["release"] = self.release
        if self.environment:
            dct["environment"] = self.environment
        if self.session_status:
            dct["session.status"] = self.session_status

        return dct


class Group(TypedDict):
    series: MutableMapping[SessionsQueryFunction, List[SessionsQueryValue]]
    totals: MutableMapping[SessionsQueryFunction, SessionsQueryValue]


def default_for(field: SessionsQueryFunction) -> SessionsQueryValue:
    return 0 if field in ("sum(session)", "count_unique(user)") else None


class Field:
    def extract_values(self, raw_groupby, input_groups, output_groups):
        for metric_field in self.get_metric_fields(raw_groupby):
            field_name = (
                f"{metric_field.op}({metric_field.metric_name})"
                if metric_field.op
                else metric_field.metric_name
            )
            session_status = self.metric_field_to_session_status[metric_field]
            for input_group_key, group in input_groups.items():
                group_key = replace(input_group_key, session_status=session_status)
                for subgroup in ("totals", "series"):
                    value = group[subgroup][field_name]
                    if isinstance(value, list):
                        value = [self.normalize(x) for x in value]
                    else:
                        value = self.normalize(value)
                    output_groups[group_key][subgroup][self.name] = value

    def get_groupby(self, raw_groupby):
        for groupby in raw_groupby:
            if groupby == "session.status":
                continue
            elif groupby == "project":
                yield "project_id"
            else:
                yield groupby

    def normalize(self, value):
        return finite_or_none(value)


class IntegerField(Field):
    def normalize(self, value):
        value = super().normalize(value)
        if isinstance(value, float):
            return int(value)
        return value


class SessionsField(IntegerField):

    name = "sum(session)"

    metric_field_to_session_status = {
        MetricField(None, SessionMetricKey.HEALTHY.value): "healthy",
        MetricField(None, SessionMetricKey.ABNORMAL.value): "abnormal",
        MetricField(None, SessionMetricKey.CRASHED.value): "crashed",
        MetricField(None, SessionMetricKey.ERRORED.value): "errored",
        MetricField(None, SessionMetricKey.ALL.value): None,
    }

    def get_metric_fields(self, raw_groupby):
        if "session.status" in raw_groupby:
            return [
                MetricField(None, SessionMetricKey.HEALTHY.value),
                MetricField(None, SessionMetricKey.ABNORMAL.value),
                MetricField(None, SessionMetricKey.CRASHED.value),
                MetricField(None, SessionMetricKey.ERRORED.value),
            ]
        return [MetricField(None, SessionMetricKey.ALL.value)]


class UsersField(IntegerField):
    name = "count_unique(user)"

    metric_field_to_session_status = {
        MetricField(None, SessionMetricKey.HEALTHY_USER.value): "healthy",
        MetricField(None, SessionMetricKey.ABNORMAL_USER.value): "abnormal",
        MetricField(None, SessionMetricKey.CRASHED_USER.value): "crashed",
        MetricField(None, SessionMetricKey.ERRORED_USER.value): "errored",
        MetricField(None, SessionMetricKey.ALL_USER.value): None,
    }

    def get_metric_fields(self, raw_groupby):
        if "session.status" in raw_groupby:
            return [
                MetricField(None, SessionMetricKey.HEALTHY_USER.value),
                MetricField(None, SessionMetricKey.ABNORMAL_USER.value),
                MetricField(None, SessionMetricKey.CRASHED_USER.value),
                MetricField(None, SessionMetricKey.ERRORED_USER.value),
            ]
        return [MetricField(None, SessionMetricKey.ALL_USER.value)]


class DurationField(Field):
    def __init__(self, name: SessionsQueryFunction):
        self.name = name
        self.op = name[:3]  # That this works is just a lucky coincidence

    @property
    def metric_field_to_session_status(self):
        return {
            MetricField(self.op, SessionMetricKey.DURATION.value): "healthy",
            # TODO: Handle non-groupby case
        }

    def get_metric_fields(self, raw_groupby):
        return [MetricField(self.op, SessionMetricKey.DURATION.value)]

    def normalize(self, value):
        value = finite_or_none(value)
        if value is not None:
            value *= 1000
        return value


COLUMN_MAP = {
    SessionsField.name: SessionsField(),
    UsersField.name: UsersField(),
    "avg(session.duration)": DurationField("avg(session.duration)"),
    "p50(session.duration)": DurationField("p50(session.duration)"),
    "p75(session.duration)": DurationField("p75(session.duration)"),
    "p90(session.duration)": DurationField("p90(session.duration)"),
    "p95(session.duration)": DurationField("p95(session.duration)"),
    "p99(session.duration)": DurationField("p99(session.duration)"),
    "max(session.duration)": DurationField("max(session.duration)"),
}


def run_sessions_query(
    org_id: int,
    query: QueryDefinition,
    span_op: str,
) -> SessionsQueryResult:
    """Convert a QueryDefinition to multiple snuba queries and reformat the results"""
    # This is necessary so that we do not mutate the query object shared between different
    # backend runs
    query = deepcopy(query)

    from sentry.snuba.metrics.query import QueryDefinition as MetricsQuery

    fields = [COLUMN_MAP[field_name] for field_name in query.raw_fields]

    filter_keys = query.filter_keys.copy()
    project_ids = filter_keys.pop("project_id")
    assert not filter_keys

    metrics_query = MetricsQuery(
        org_id,
        project_ids,
        list({column for field in fields for column in field.get_metric_fields(query.raw_groupby)}),
        query.start,
        query.end,
        Granularity(query.rollup),
        where=_get_filter_conditions(query.conditions),
        groupby=list(
            {column for field in fields for column in field.get_groupby(query.raw_groupby)}
        ),
    )

    # TODO: Stop passing project IDs everywhere
    projects = Project.objects.get_many_from_cache(project_ids)
    results = get_series(projects, metrics_query)

    input_groups = {GroupKey.from_input_dict(group["by"]): group for group in results["groups"]}

    output_groups: MutableMapping[GroupKey, Group] = defaultdict(
        lambda: {
            "totals": {field: default_for(field) for field in query.raw_fields},
            "series": {
                field: len(results["intervals"]) * [default_for(field)]
                for field in query.raw_fields
            },
        }
    )

    for field in fields:
        field.extract_values(query.raw_groupby, input_groups, output_groups)

    # Convert group keys back to dictionaries:
    results["groups"] = [
        {"by": group_key.to_output_dict(), **group} for group_key, group in output_groups.items()
    ]

    # Finally, serialize timestamps:
    results["start"] = isoformat_z(results["start"])
    results["end"] = isoformat_z(results["end"])
    results["intervals"] = [isoformat_z(ts) for ts in results["intervals"]]
    results["query"] = results.get("query", "")

    return results


def _get_filter_conditions(conditions: Sequence[Condition]) -> Any:
    """Translate given conditions to snql"""
    dummy_entity = EntityKey.MetricsSets.value
    return json_to_snql(
        {"selected_columns": ["value"], "conditions": conditions}, entity=dummy_entity
    ).where
