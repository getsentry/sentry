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
    Set,
    Tuple,
    Type,
    TypedDict,
    Union,
    cast,
)

from snuba_sdk import (
    BooleanCondition,
    Column,
    Condition,
    Direction,
    Function,
    Granularity,
    Limit,
    Offset,
    Op,
)
from snuba_sdk.conditions import ConditionGroup
from snuba_sdk.legacy import json_to_snql

from sentry.api.utils import InvalidParams as UtilsInvalidParams
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
from sentry.snuba.metrics.utils import OrderByNotSupportedOverCompositeEntityException
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


ALL_STATUSES = frozenset(iter(SessionStatus))


#: Used to filter results by session.status
StatusFilter = Optional[FrozenSet[SessionStatus]]


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
        if self.release is not None:
            dct["release"] = self.release
        if self.environment is not None:
            dct["environment"] = self.environment
        if self.session_status is not None:
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
        status_filter: StatusFilter,
    ):
        self.name = name
        self._raw_groupby = raw_groupby
        self._status_filter = status_filter
        self._hidden_fields: Set[MetricField] = set()
        self.metric_fields = self._get_metric_fields(raw_groupby, status_filter)

    @abstractmethod
    def _get_session_status(self, metric_field: MetricField) -> Optional[SessionStatus]:
        ...

    @abstractmethod
    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: StatusFilter
    ) -> Sequence[MetricField]:
        ...

    def extract_values(
        self,
        input_groups: GroupedData,
        output_groups: GroupedData,
    ) -> None:
        for metric_field in self.metric_fields:
            session_status = self._get_session_status(metric_field)
            if metric_field in self._hidden_fields:
                # We fetched this only to get a consistent sort order
                # in the original implementation, don't add it to output data
                continue
            field_name = (
                f"{metric_field.op}({metric_field.metric_name})"
                if metric_field.op
                else metric_field.metric_name
            )
            for input_group_key, group in input_groups.items():
                if session_status and not self._status_filter:
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
        Default is the new value"""
        return new_value


UNSORTABLE = {SessionStatus.HEALTHY, SessionStatus.ERRORED}


class CountField(Field):
    """Base class for sum(sessions) and count_unique(user)"""

    status_to_metric_field: Mapping[Optional[SessionStatus], MetricField] = {}

    def get_all_field(self) -> MetricField:
        return self.status_to_metric_field[None]

    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: StatusFilter
    ) -> Sequence[MetricField]:
        if status_filter:
            # Restrict fields to the included ones
            metric_fields = [self.status_to_metric_field[status] for status in status_filter]
            if UNSORTABLE & status_filter:
                self._hidden_fields.add(self.get_all_field())
                # We always order the results by one of the selected fields,
                # even if no orderBy is specified (see _primary_field).
                metric_fields = [self.get_all_field()] + metric_fields
            return metric_fields

        if "session.status" in raw_groupby:
            self._hidden_fields.add(self.get_all_field())
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
        if "session.status" in self._raw_groupby:
            reverse_lookup = {v: k for k, v in self.status_to_metric_field.items()}
            return reverse_lookup[metric_field]
        return None

    def normalize(self, value: Scalar) -> Scalar:
        value = super().normalize(value)
        # In the sessions API, sum() and count_unique() return integers
        if isinstance(value, float):
            return int(value)
        return value


class SumSessionField(CountField):
    status_to_metric_field = {
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


class CountUniqueUser(CountField):
    def __init__(
        self,
        name: str,
        raw_groupby: Sequence[str],
        status_filter: StatusFilter,
    ):
        # We cannot do set arithmetic outside of the metrics API:
        if status_filter and len(status_filter) > 1 and "session.status" not in raw_groupby:
            raise InvalidParams(
                "Cannot filter count_unique by multiple session.status unless it is in groupBy"
            )

        super().__init__(name, raw_groupby, status_filter)

    status_to_metric_field = {
        SessionStatus.HEALTHY: MetricField(None, SessionMetricKey.HEALTHY_USER.value),
        SessionStatus.ABNORMAL: MetricField(None, SessionMetricKey.ABNORMAL_USER.value),
        SessionStatus.CRASHED: MetricField(None, SessionMetricKey.CRASHED_USER.value),
        SessionStatus.ERRORED: MetricField(None, SessionMetricKey.ERRORED_USER.value),
        None: MetricField(None, SessionMetricKey.ALL_USER.value),
    }


class DurationField(Field):
    def __init__(self, name: str, raw_groupby: Sequence[str], status_filter: StatusFilter):
        self.op = name[:3]  # That this works is just a lucky coincidence
        super().__init__(name, raw_groupby, status_filter)

    def _get_session_status(self, metric_field: MetricField) -> Optional[SessionStatus]:
        assert metric_field == MetricField(self.op, SessionMetricKey.DURATION.value)
        if "session.status" in self._raw_groupby:
            return SessionStatus.HEALTHY
        return None

    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: StatusFilter
    ) -> Sequence[MetricField]:
        if status_filter is None or SessionStatus.HEALTHY in status_filter:
            return [MetricField(self.op, SessionMetricKey.DURATION.value)]

        return []  # TODO: test if we can handle zero fields

    def normalize(self, value: Scalar) -> Scalar:
        value = finite_or_none(value)
        if value is not None:
            value *= 1000
        return value


class SimpleForwardingField(Field):
    """A field that forwards a metrics API field 1:1.

    On this type of field, grouping and filtering by session.status is impossible
    """

    field_name_to_metric_name = {
        "crash_rate(session)": SessionMetricKey.CRASH_RATE,
        "crash_rate(user)": SessionMetricKey.CRASH_USER_RATE,
        "crash_free_rate(session)": SessionMetricKey.CRASH_FREE_RATE,
        "crash_free_rate(user)": SessionMetricKey.CRASH_FREE_USER_RATE,
    }

    def __init__(self, name: str, raw_groupby: Sequence[str], status_filter: StatusFilter):
        if "session.status" in raw_groupby:
            raise InvalidParams(f"Cannot group field {name} by session.status")
        if status_filter is not None:
            raise InvalidParams(f"Cannot filter field {name} by session.status")

        metric_name = self.field_name_to_metric_name[name].value
        self._metric_field = MetricField(None, metric_name)

        super().__init__(name, raw_groupby, status_filter)

    def _get_session_status(self, metric_field: MetricField) -> Optional[SessionStatus]:
        return None

    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: StatusFilter
    ) -> Sequence[MetricField]:
        return [self._metric_field]


FIELD_MAP: Mapping[SessionsQueryFunction, Type[Field]] = {
    "sum(session)": SumSessionField,
    "count_unique(user)": CountUniqueUser,
    "avg(session.duration)": DurationField,
    "p50(session.duration)": DurationField,
    "p75(session.duration)": DurationField,
    "p90(session.duration)": DurationField,
    "p95(session.duration)": DurationField,
    "p99(session.duration)": DurationField,
    "max(session.duration)": DurationField,
    "crash_rate(session)": SimpleForwardingField,
    "crash_rate(user)": SimpleForwardingField,
    "crash_free_rate(session)": SimpleForwardingField,
    "crash_free_rate(user)": SimpleForwardingField,
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
    if not intervals:
        return _empty_result(query)

    conditions = _get_filter_conditions(query.conditions)
    where, status_filter = _extract_status_filter_from_conditions(conditions)
    if status_filter == frozenset():
        # There was a condition that cannot be met, such as 'session:status:foo'
        # no need to query metrics, just return empty groups.
        return _empty_result(query)

    fields = {
        field_name: FIELD_MAP[field_name](field_name, query.raw_groupby, status_filter)
        for field_name in query.raw_fields
    }

    # Remove fields that do not query anything:
    fields = {field_name: field for field_name, field in fields.items() if field.metric_fields}

    if not fields:
        return _empty_result(query)

    filter_keys = query.filter_keys.copy()
    project_ids = filter_keys.pop("project_id")
    assert not filter_keys

    orderby = _parse_orderby(query, fields)
    if orderby is None:
        # We only return the top-N groups, based on the first field that is being
        # queried, assuming that those are the most relevant to the user.
        # In a future iteration we might expose an `orderBy` query parameter.
        primary_metric_field = _get_primary_field(list(fields.values()), query.raw_groupby)
        orderby = OrderBy(primary_metric_field, Direction.DESC)

    max_groups = SNUBA_LIMIT // len(intervals)
    metrics_query = MetricsQuery(
        org_id,
        project_ids,
        list({column for field in fields.values() for column in field.metric_fields}),
        query.start,
        query.end,
        Granularity(query.rollup),
        where=where,
        groupby=list({column for field in fields.values() for column in field.get_groupby()}),
        orderby=orderby,
        limit=Limit(min(query.limit or max_groups, max_groups)),
        offset=Offset(query.offset or 0),
    )

    # TODO: Stop passing project IDs everywhere
    projects = Project.objects.get_many_from_cache(project_ids)
    try:
        metrics_results = get_series(projects, metrics_query)
    except OrderByNotSupportedOverCompositeEntityException:
        raise InvalidParams(f"Cannot order by {query.raw_orderby[0]} with the current filters")
    except UtilsInvalidParams as e:
        raise InvalidParams(e)

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

    for field in fields.values():
        field.extract_values(input_groups, output_groups)

    if not output_groups:
        # Generate default groups to be consistent with original sessions_v2
        # implementation. This can be removed when we have stopped comparing
        # See also https://github.com/getsentry/sentry/pull/32157.
        if not query.raw_groupby:
            output_groups[GroupKey()]
        elif ["session.status"] == query.raw_groupby:
            for status in SessionStatus:
                # Create entry in default dict:
                output_groups[GroupKey(session_status=status)]

    return {
        "groups": [
            # Convert group keys back to dictionaries:
            {"by": group_key.to_output_dict(), **group}  # type: ignore
            for group_key, group in output_groups.items()
        ],
        "start": isoformat_z(metrics_results["start"]),
        "end": isoformat_z(metrics_results["end"]),
        "intervals": [isoformat_z(ts) for ts in metrics_results["intervals"]],
        "query": query.query,
    }


def _empty_result(query: QueryDefinition) -> SessionsQueryResult:
    intervals = get_timestamps(query)
    return {
        "groups": [],
        "start": query.start,
        "end": query.end,
        "intervals": intervals,
        "query": query.query,
    }


def _get_filter_conditions(conditions: Any) -> ConditionGroup:
    """Translate given conditions to snql"""
    dummy_entity = EntityKey.MetricsSets.value
    return json_to_snql(
        {"selected_columns": ["value"], "conditions": conditions}, entity=dummy_entity
    ).query.where


def _extract_status_filter_from_conditions(
    conditions: ConditionGroup,
) -> Tuple[ConditionGroup, StatusFilter]:
    """Split conditions into metrics conditions and a filter on session.status"""
    if not conditions:
        return conditions, None
    where, status_filters = zip(*map(_transform_single_condition, conditions))
    where = [condition for condition in where if condition is not None]
    status_filters = [f for f in status_filters if f is not None]
    if status_filters:
        status_filters = frozenset.intersection(*status_filters)
    else:
        status_filters = None
    return where, status_filters


def _transform_single_condition(
    condition: Union[Condition, BooleanCondition]
) -> Tuple[Optional[Union[Condition, BooleanCondition]], StatusFilter]:
    if isinstance(condition, Condition):
        if condition.lhs == Function("ifNull", parameters=[Column("session.status"), ""]):
            # HACK: metrics tags are never null. We should really
            # write our own parser for this.
            condition = replace(condition, lhs=Column("session.status"))

        if condition.lhs == Column("session.status"):
            if condition.op == Op.EQ:
                return None, _parse_session_status(condition.rhs)
            if condition.op == Op.NEQ:
                return None, ALL_STATUSES - _parse_session_status(condition.rhs)
            if condition.op == Op.IN:
                return None, frozenset.union(
                    *[_parse_session_status(status) for status in condition.rhs]
                )
            if condition.op == Op.NOT_IN:
                return None, ALL_STATUSES - frozenset.union(
                    *[_parse_session_status(status) for status in condition.rhs]
                )
            raise InvalidParams("Unable to resolve session.status filter")

    if "session.status" in str(condition):
        # Anything not handled by the code above cannot be parsed for now,
        # for two reasons:
        # 1) Queries like session.status:healthy OR release:foo are hard to
        #    translate, because they would require different conditions on the separate
        #    metric fields.
        # 2) AND and OR conditions come in the form `Condition(Function("or", [...]), Op.EQ, 1)`
        #    where [...] can again contain any condition encoded as a Function. For this, we would
        #    have to replicate the translation code above.
        raise InvalidParams("Unable to parse condition with session.status")

    return condition, None


def _parse_session_status(status: Any) -> FrozenSet[SessionStatus]:
    try:
        return frozenset([SessionStatus(status)])
    except ValueError:
        return frozenset()


def _parse_orderby(
    query: QueryDefinition, fields: Mapping[SessionsQueryFunction, Field]
) -> Optional[OrderBy]:
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

    field = fields[orderby]

    if len(field.metric_fields) != 1:
        # This can still happen when we filter by session.status
        raise InvalidParams(f"Cannot order by {field.name} with the current filters")

    return OrderBy(field.metric_fields[0], direction)


def _get_primary_field(fields: Sequence[Field], raw_groupby: Sequence[str]) -> MetricField:
    """Determine the field by which results will be ordered in case there is no orderBy"""
    primary_metric_field = None
    for i, field in enumerate(fields):
        if i == 0 or field.name == "sum(session)":
            primary_metric_field = field.metric_fields[0]

    assert primary_metric_field
    return primary_metric_field
