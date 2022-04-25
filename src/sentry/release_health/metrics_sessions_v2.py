""" This module offers the same functionality as sessions_v2, but pulls its data
from the `metrics` dataset instead of `sessions`.

Do not call this module directly. Use the `release_health` service instead. """
import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass, replace
from enum import Enum
from typing import (
    Any,
    Iterable,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    TypedDict,
    Union,
    cast,
)

from snuba_sdk import Condition, Direction, Granularity, Limit
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
from sentry.snuba.metrics.query import MetricField, OrderBy
from sentry.snuba.sessions_v2 import (
    SNUBA_LIMIT,
    InvalidParams,
    QueryDefinition,
    finite_or_none,
    get_timestamps,
    isoformat_z,
)

logger = logging.getLogger(__name__)

#: Group key as featured in output format
GroupKeyDict = TypedDict(
    "GroupKeyDict",
    {"project": int, "release": str, "environment": str, "session.status": str},
    total=False,
)


#: Group key as featured in metrics format
class MetricsGroupKeyDict(TypedDict, total=False):
    project_id: int
    release: str
    environment: str


class SessionStatus(Enum):
    ABNORMAL = "abnormal"
    CRASHED = "crashed"
    ERRORED = "errored"
    HEALTHY = "healthy"


@dataclass(frozen=True)
class GroupKey:
    """Hashable version of group key dict"""

    project: Optional[int] = None
    release: Optional[str] = None
    environment: Optional[str] = None
    session_status: Optional[str] = None

    @staticmethod
    def from_input_dict(dct: MetricsGroupKeyDict) -> "GroupKey":
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


GroupedData = Mapping[GroupKey, Any]


class Field(ABC):

    name: str

    @abstractmethod
    def get_session_status(
        self, metric_field: MetricField, raw_groupby: Sequence[str]
    ) -> Optional[str]:
        ...

    @abstractmethod
    def get_metric_fields(self, raw_groupby: Sequence[str]) -> Sequence[MetricField]:
        ...

    def extract_values(
        self,
        raw_groupby: Sequence[str],
        input_groups: GroupedData,
        output_groups: GroupedData,
    ) -> None:
        is_groupby_status = "session.status" in raw_groupby
        for metric_field in self.get_metric_fields(raw_groupby):
            session_status = self.get_session_status(metric_field, raw_groupby)
            if is_groupby_status and session_status is None:
                # We fetched this only to be consistent with the sort order
                # in the original implementation, don't add it to output data
                continue
            field_name = (
                f"{metric_field.op}({metric_field.metric_name})"
                if metric_field.op
                else metric_field.metric_name
            )
            for input_group_key, group in input_groups.items():
                if session_status:
                    self.ensure_status_groups(input_group_key, output_groups)
                group_key = replace(input_group_key, session_status=session_status)
                for subgroup in ("totals", "series"):
                    value = group[subgroup][field_name]
                    if isinstance(value, list):
                        value = [self.normalize(x) for x in value]
                    else:
                        value = self.normalize(value)
                    output_groups[group_key][subgroup][self.name] = value

    def ensure_status_groups(self, input_group_key: GroupKey, output_groups: GroupedData) -> None:
        # To be consistent with original sessions implementation,
        # always create defaults for all session status groups
        for session_status in SessionStatus:
            group_key = replace(input_group_key, session_status=session_status.value)
            output_groups[group_key]  # creates entry in defaultdict

    def get_groupby(self, raw_groupby: Sequence[str]) -> Iterable[str]:
        for groupby in raw_groupby:
            if groupby == "session.status":
                continue
            elif groupby == "project":
                yield "project_id"
            else:
                yield groupby

    def normalize(self, value: Union[int, float, None]) -> Union[int, float, None]:
        return cast(Union[int, float, None], finite_or_none(value))


class IntegerField(Field):
    def normalize(self, value: Union[int, float, None]) -> Union[int, float, None]:
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

    def get_session_status(
        self, metric_field: MetricField, raw_groupby: Sequence[str]
    ) -> Optional[str]:
        return self.metric_field_to_session_status[metric_field]

    def get_metric_fields(self, raw_groupby: Sequence[str]) -> Sequence[MetricField]:
        if "session.status" in raw_groupby:
            return [
                # Always also get ALL, because this is what we sort by
                # in the sessions implementation, with which we want to be consistent
                MetricField(None, SessionMetricKey.ALL.value),
                # These are the fields we actually need:
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

    def get_session_status(
        self, metric_field: MetricField, raw_groupby: Sequence[str]
    ) -> Optional[str]:
        return self.metric_field_to_session_status[metric_field]

    def get_metric_fields(self, raw_groupby: Sequence[str]) -> Sequence[MetricField]:
        if "session.status" in raw_groupby:
            return [
                # Always also get ALL, because this is what we sort by
                # in the sessions implementation, with which we want to be consistent
                MetricField(None, SessionMetricKey.ALL_USER.value),
                # These are the fields we actually need:
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

    def get_session_status(
        self, metric_field: MetricField, raw_groupby: Sequence[str]
    ) -> Optional[str]:
        assert metric_field == MetricField(self.op, SessionMetricKey.DURATION.value)
        if "session.status" in raw_groupby:
            return "healthy"
        return None

    def get_metric_fields(self, raw_groupby: Sequence[str]) -> Sequence[MetricField]:
        return [MetricField(self.op, SessionMetricKey.DURATION.value)]

    def normalize(self, value: Union[int, float, None]) -> Union[int, float, None]:
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

    orderby = _parse_orderby(query)
    if orderby is None:
        # We only return the top-N groups, based on the first field that is being
        # queried, assuming that those are the most relevant to the user.
        # In a future iteration we might expose an `orderBy` query parameter.
        primary_metric_field = _get_primary_field(fields, query.raw_groupby)
        orderby = OrderBy(primary_metric_field, Direction.DESC)

    max_groups = SNUBA_LIMIT // len(get_timestamps(query))

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
        orderby=orderby,
        limit=Limit(max_groups),
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

    if not output_groups:
        # Generate default groups to be consistent with original sessions_v2
        # implementation. This can be removed when we have stopped comparing
        # See also https://github.com/getsentry/sentry/pull/32157.
        if not query.raw_groupby:
            output_groups[GroupKey()]
        elif ["session.status"] == query.raw_groupby:
            for status in SessionStatus:
                # Create entry in default dict:
                output_groups[GroupKey(session_status=status.value)]

    # Convert group keys back to dictionaries:
    results["groups"] = [
        {"by": group_key.to_output_dict(), **group} for group_key, group in output_groups.items()  # type: ignore
    ]

    # Finally, serialize timestamps:
    results["start"] = isoformat_z(results["start"])
    results["end"] = isoformat_z(results["end"])
    results["intervals"] = [isoformat_z(ts) for ts in results["intervals"]]
    results["query"] = results.get("query", "")

    return cast(SessionsQueryResult, results)


def _get_filter_conditions(conditions: Sequence[Condition]) -> Any:
    """Translate given conditions to snql"""
    dummy_entity = EntityKey.MetricsSets.value
    return json_to_snql(
        {"selected_columns": ["value"], "conditions": conditions}, entity=dummy_entity
    ).where


def _parse_orderby(query: QueryDefinition) -> Optional[OrderBy]:
    orderbys = query.raw_orderby
    if orderbys == []:
        return None
    if len(orderbys) > 1:
        raise InvalidParams("Cannot order by multiple fields")
    orderby = orderbys[0]

    if "session.status" in query.raw_groupby:
        raise InvalidParams("Cannot use 'orderBy' when grouping by sessions.status")

    direction = Direction.ASC
    if orderby[0] == "-":
        orderby = orderby[1:]
        direction = Direction.DESC

    assert query.raw_fields
    if orderby not in query.raw_fields:
        raise InvalidParams("'orderBy' must be one of the provided 'fields'")
    field = COLUMN_MAP[orderby]

    metric_fields = field.get_metric_fields(query.raw_groupby)

    # Because we excluded groupBy session status, we should have a one-to-one mapping now
    assert len(metric_fields) == 1

    return OrderBy(metric_fields[0], direction)


def _get_primary_field(fields: Sequence[Field], raw_groupby: Sequence[str]) -> MetricField:
    """Determine the field by which results will be ordered in case there is no orderBy"""
    primary_metric_field = None
    for i, field in enumerate(fields):
        if i == 0 or field.name == "sum(session)":
            primary_metric_field = field.get_metric_fields(raw_groupby)[0]

    assert primary_metric_field
    return primary_metric_field
