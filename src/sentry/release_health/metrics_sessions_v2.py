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
    FrozenSet,
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
from sentry.snuba.metrics.query import QueryDefinition as MetricsQuery
from sentry.snuba.sessions_v2 import (
    SNUBA_LIMIT,
    InvalidParams,
    QueryDefinition,
    finite_or_none,
    get_timestamps,
    isoformat_z,
)

logger = logging.getLogger(__name__)

Scalar = Union[int, float, None]

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
    session_status: Optional[SessionStatus] = None

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
            dct["session.status"] = self.session_status.value

        return dct


class Group(TypedDict):
    series: MutableMapping[SessionsQueryFunction, List[SessionsQueryValue]]
    totals: MutableMapping[SessionsQueryFunction, SessionsQueryValue]


def default_for(field: SessionsQueryFunction) -> SessionsQueryValue:
    return 0 if field in ("sum(session)", "count_unique(user)") else None


GroupedData = Mapping[GroupKey, Any]


class Field(ABC):
    def __init__(
        self,
        name: str,
        raw_groupby: Sequence[str],
        status_filter: Optional[FrozenSet[SessionStatus]],
    ):
        self.name = name
        self._raw_groupby = raw_groupby
        self.metric_fields = self._get_metric_fields(raw_groupby, status_filter)

    @abstractmethod
    def _get_session_status(self, metric_field: MetricField) -> Optional[SessionStatus]:
        ...

    @abstractmethod
    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: Optional[FrozenSet[SessionStatus]]
    ) -> Sequence[MetricField]:
        ...

    def extract_values(
        self,
        input_groups: GroupedData,
        output_groups: GroupedData,
    ) -> None:
        is_groupby_status = "session.status" in self._raw_groupby
        for metric_field in self.metric_fields:
            session_status = self._get_session_status(metric_field)
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
                    target = output_groups[group_key][subgroup]
                    previous_value = target[self.name]
                    value = group[subgroup][field_name]
                    if isinstance(value, list):
                        value = [
                            self.accumulate(prev, self.normalize(x))
                            for prev, x in zip(previous_value, value)
                        ]
                    else:
                        value = self.accumulate(previous_value, self.normalize(value))
                    target[self.name] = value

    def ensure_status_groups(self, input_group_key: GroupKey, output_groups: GroupedData) -> None:
        # To be consistent with original sessions implementation,
        # always create defaults for all session status groups
        for session_status in SessionStatus:
            group_key = replace(input_group_key, session_status=session_status)
            output_groups[group_key]  # creates entry in defaultdict

    def get_groupby(self) -> Iterable[str]:
        for groupby in self._raw_groupby:
            if groupby == "session.status":
                continue
            elif groupby == "project":
                yield "project_id"
            else:
                yield groupby

    def normalize(self, value: Scalar) -> Scalar:
        return cast(Scalar, finite_or_none(value))

    def accumulate(self, old_value: Scalar, new_value: Scalar) -> Scalar:
        """Combine two numbers for the same target.
        Only needed by SumSessionField, default is the new value"""
        return new_value


class CountField(Field):
    """Base class for sum(sessions) and count_unique(user)"""

    status_to_metric_field: Mapping[Optional[SessionStatus], MetricField] = {}

    def get_all_field(self) -> MetricField:
        return self.status_to_metric_field[None]

    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: Optional[FrozenSet[SessionStatus]]
    ) -> Sequence[MetricField]:
        if status_filter:
            # Restrict fields to the included ones
            return [self.status_to_metric_field[status] for status in status_filter]

        if "session.status" in raw_groupby:
            return [
                # Always also get ALL, because this is what we sort by
                # in the sessions implementation, with which we want to be consistent
                self.get_all_field(),
                # These are the fields we actually need:
                self.status_to_metric_field[SessionStatus.HEALTHY],
                self.status_to_metric_field[SessionStatus.ABNORMAL],
                self.status_to_metric_field[SessionStatus.CRASHED],
                self.status_to_metric_field[SessionStatus.ERRORED],
            ]

        return [self.get_all_field()]

    def _get_session_status(self, metric_field: MetricField) -> Optional[SessionStatus]:
        reverse_lookup = {v: k for k, v in self.status_to_metric_field.items()}
        return reverse_lookup[metric_field]

    def normalize(self, value: Scalar) -> Scalar:
        value = super().normalize(value)
        # In the sessions API, sum() and count_unique() return integers
        if isinstance(value, float):
            return int(value)
        return value


class SessionsField(CountField):
    name = "sum(session)"

    session_status_fields = {
        SessionStatus.HEALTHY: MetricField(None, SessionMetricKey.HEALTHY.value),
        SessionStatus.ABNORMAL: MetricField(None, SessionMetricKey.ABNORMAL.value),
        SessionStatus.CRASHED: MetricField(None, SessionMetricKey.CRASHED.value),
        SessionStatus.ERRORED: MetricField(None, SessionMetricKey.ERRORED.value),
        None: MetricField(None, SessionMetricKey.ALL.value),
    }

    def accumulate(self, old_value: Scalar, new_value: Scalar) -> Scalar:
        # This is only needed for a single specific scenario:
        # When we filter by more than one session.status (e.g. crashed and abnormal),
        # but do *not* group by session.status, we want to sum up the values from the different metrics,
        # e.g. session.crashed + session.abnormal
        assert isinstance(old_value, int)
        assert isinstance(new_value, int)
        return old_value + new_value


class UsersField(CountField):
    name = "count_unique(user)"

    session_status_fields = {
        SessionStatus.HEALTHY: MetricField(None, SessionMetricKey.HEALTHY_USER.value),
        SessionStatus.ABNORMAL: MetricField(None, SessionMetricKey.ABNORMAL_USER.value),
        SessionStatus.CRASHED: MetricField(None, SessionMetricKey.CRASHED_USER.value),
        SessionStatus.ERRORED: MetricField(None, SessionMetricKey.ERRORED_USER.value),
        None: MetricField(None, SessionMetricKey.ALL_USER.value),
    }


class DurationField(Field):
    def __init__(self, name: SessionsQueryFunction):
        self.name = name
        self.op = name[:3]  # That this works is just a lucky coincidence

    def _get_session_status(self, metric_field: MetricField) -> Optional[SessionStatus]:
        assert metric_field == MetricField(self.op, SessionMetricKey.DURATION.value)
        if "session.status" in self._raw_groupby:
            return SessionStatus.HEALTHY
        return None

    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: Optional[FrozenSet[SessionStatus]]
    ) -> Sequence[MetricField]:
        if status_filter is None or SessionStatus.HEALTHY in status_filter:
            return [MetricField(self.op, SessionMetricKey.DURATION.value)]

        return []  # TODO: test if we can handle zero fields

    def normalize(self, value: Scalar) -> Scalar:
        value = finite_or_none(value)
        if value is not None:
            value *= 1000
        return value


COLUMN_MAP = {
    "sum(session)": SessionsField,
    "count_unique(user)": UsersField,
    "avg(session.duration)": DurationField,
    "p50(session.duration)": DurationField,
    "p75(session.duration)": DurationField,
    "p90(session.duration)": DurationField,
    "p95(session.duration)": DurationField,
    "p99(session.duration)": DurationField,
    "max(session.duration)": DurationField,
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

    intervals = get_timestamps(query)

    where, status_filter = _get_filter_conditions(query.conditions)
    if status_filter == []:
        # There was a condition that cannot be met, such as 'session:status:foo'
        # no need to query metrics, just return empty groups.
        return {
            "groups": [],
            "start": isoformat_z(intervals[0]),
            "end": isoformat_z(intervals[-1]),
            "intervals": [isoformat_z(ts) for ts in intervals],
            "query": query.query,
        }

    fields = [
        COLUMN_MAP[field_name](field_name, query.raw_groupby, status_filter)
        for field_name in query.raw_fields
    ]

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

    max_groups = SNUBA_LIMIT // len(intervals)

    metrics_query = MetricsQuery(
        org_id,
        project_ids,
        list(
            {
                column
                for field in fields
                for column in field.get_metric_fields(query.raw_groupby, status_filter)
            }
        ),
        query.start,
        query.end,
        Granularity(query.rollup),
        where=where,
        groupby=list({column for field in fields for column in field.get_groupby()}),
        orderby=orderby,
        limit=Limit(max_groups),
    )

    # TODO: Stop passing project IDs everywhere
    projects = Project.objects.get_many_from_cache(project_ids)
    metrics_results = get_series(projects, metrics_query)

    input_groups = {
        GroupKey.from_input_dict(group["by"]): group for group in metrics_results["groups"]
    }

    output_groups: MutableMapping[GroupKey, Group] = defaultdict(
        lambda: {
            "totals": {field: default_for(field) for field in query.raw_fields},
            "series": {
                field: len(metrics_results["intervals"]) * [default_for(field)]
                for field in query.raw_fields
            },
        }
    )

    for field in fields:
        field.extract_values(input_groups, output_groups)

    return {
        "groups": [
            # Convert group keys back to dictionaries:
            {"by": group_key.to_output_dict(), **group}  # type: ignore
            for group_key, group in output_groups.items()
        ],
        "start": isoformat_z(metrics_results["start"]),
        "end": isoformat_z(metrics_results["end"]),
        "intervals": [isoformat_z(ts) for ts in metrics_results["intervals"]],
        "query": metrics_results.get("query", ""),
    }


def _get_filter_conditions(conditions: Sequence[Condition]) -> Any:
    """Translate given conditions to snql"""
    dummy_entity = EntityKey.MetricsSets.value
    return json_to_snql(
        {"selected_columns": ["value"], "conditions": conditions}, entity=dummy_entity
    ).where


def _parse_orderby(query: QueryDefinition) -> Optional[OrderBy]:
    orderby = query.raw_orderby
    if orderby is None:
        return None

    if "session.status" in query.raw_groupby:
        raise InvalidParams("Cannot use 'orderBy' when grouping by sessions.status")

    direction = Direction.ASC
    if orderby[0] == "-":
        orderby = orderby[1:]
        direction = Direction.DESC

    assert query.raw_fields
    if orderby not in query.raw_fields:
        raise InvalidParams("'orderBy' must be one of the provided 'fields'")
    field = COLUMN_MAP[orderby](query)

    # Because we excluded groupBy session status, we should have a one-to-one mapping now
    assert len(field.metric_fields) == 1

    return OrderBy(field.metric_fields[0], direction)


def _get_primary_field(fields: Sequence[Field], raw_groupby: Sequence[str]) -> MetricField:
    """Determine the field by which results will be ordered in case there is no orderBy"""
    primary_metric_field = None
    for i, field in enumerate(fields):
        if i == 0 or field.name == "sum(session)":
            primary_metric_field = field.metric_fields[0]

    assert primary_metric_field
    return primary_metric_field
