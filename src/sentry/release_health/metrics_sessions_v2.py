""" This module offers the same functionality as sessions_v2, but pulls its data
from the `metrics` dataset instead of `sessions`.

Do not call this module directly. Use the `release_health` service instead. """

import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping, MutableMapping, Sequence
from copy import deepcopy
from dataclasses import dataclass, replace
from enum import Enum
from typing import Any, Literal, Optional, TypedDict, Union, cast

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

from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.release_health.base import (
    GroupByFieldName,
    ProjectId,
    SessionsQueryFunction,
    SessionsQueryGroup,
    SessionsQueryResult,
    SessionsQueryValue,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics import get_public_name_from_mri
from sentry.snuba.metrics.datasource import get_series
from sentry.snuba.metrics.naming_layer import SessionMRI
from sentry.snuba.metrics.query import (
    DeprecatingMetricsQuery,
    MetricField,
    MetricGroupByField,
    MetricOrderByField,
)
from sentry.snuba.metrics.utils import OrderByNotSupportedOverCompositeEntityException
from sentry.snuba.sessions_v2 import (
    NonPreflightOrderByException,
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
StatusFilter = Optional[frozenset[SessionStatus]]

MAX_POSTGRES_LIMIT = 100


@dataclass(frozen=True)
class GroupKey:
    """Hashable version of group key dict"""

    project: int | None = None
    release: str | None = None
    environment: str | None = None
    session_status: SessionStatus | None = None

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
    series: MutableMapping[SessionsQueryFunction, list[SessionsQueryValue]]
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
        self._hidden_fields: set[MetricField] = set()
        self.metric_fields = self._get_metric_fields(raw_groupby, status_filter)

    @abstractmethod
    def _get_session_status(self, metric_field: MetricField) -> SessionStatus | None: ...

    @abstractmethod
    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: StatusFilter
    ) -> Sequence[MetricField]: ...

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
                f"{metric_field.op}({get_public_name_from_mri(metric_field.metric_mri)})"
                if metric_field.op
                else get_public_name_from_mri(metric_field.metric_mri)
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

    status_to_metric_field: Mapping[SessionStatus | None, MetricField] = {}

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

    def _get_session_status(self, metric_field: MetricField) -> SessionStatus | None:
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
        SessionStatus.HEALTHY: MetricField(None, SessionMRI.HEALTHY.value),
        SessionStatus.ABNORMAL: MetricField(None, SessionMRI.ABNORMAL.value),
        SessionStatus.CRASHED: MetricField(None, SessionMRI.CRASHED.value),
        SessionStatus.ERRORED: MetricField(None, SessionMRI.ERRORED.value),
        None: MetricField(None, SessionMRI.ALL.value),
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
        SessionStatus.HEALTHY: MetricField(None, SessionMRI.HEALTHY_USER.value),
        SessionStatus.ABNORMAL: MetricField(None, SessionMRI.ABNORMAL_USER.value),
        SessionStatus.CRASHED: MetricField(None, SessionMRI.CRASHED_USER.value),
        SessionStatus.ERRORED: MetricField(None, SessionMRI.ERRORED_USER.value),
        None: MetricField(None, SessionMRI.ALL_USER.value),
    }


class DurationField(Field):
    def __init__(self, name: str, raw_groupby: Sequence[str], status_filter: StatusFilter):
        self.op = name[:3]  # That this works is just a lucky coincidence
        super().__init__(name, raw_groupby, status_filter)

    def _get_session_status(self, metric_field: MetricField) -> SessionStatus | None:
        assert metric_field == MetricField(self.op, SessionMRI.DURATION.value)
        if "session.status" in self._raw_groupby:
            return SessionStatus.HEALTHY
        return None

    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: StatusFilter
    ) -> Sequence[MetricField]:
        if status_filter is None or SessionStatus.HEALTHY in status_filter:
            return [MetricField(self.op, SessionMRI.DURATION.value)]

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
        "crash_rate(session)": SessionMRI.CRASH_RATE,
        "crash_rate(user)": SessionMRI.CRASH_USER_RATE,
        "crash_free_rate(session)": SessionMRI.CRASH_FREE_RATE,
        "crash_free_rate(user)": SessionMRI.CRASH_FREE_USER_RATE,
        "anr_rate()": SessionMRI.ANR_RATE,
        "foreground_anr_rate()": SessionMRI.FOREGROUND_ANR_RATE,
    }

    def __init__(self, name: str, raw_groupby: Sequence[str], status_filter: StatusFilter):
        if "session.status" in raw_groupby:
            raise InvalidParams(f"Cannot group field {name} by session.status")
        if status_filter is not None:
            raise InvalidParams(f"Cannot filter field {name} by session.status")

        metric_name = self.field_name_to_metric_name[name].value
        self._metric_field = MetricField(None, metric_name)

        super().__init__(name, raw_groupby, status_filter)

    def _get_session_status(self, metric_field: MetricField) -> SessionStatus | None:
        return None

    def _get_metric_fields(
        self, raw_groupby: Sequence[str], status_filter: StatusFilter
    ) -> Sequence[MetricField]:
        return [self._metric_field]


FIELD_MAP: Mapping[SessionsQueryFunction, type[Field]] = {
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
    "anr_rate()": SimpleForwardingField,
    "foreground_anr_rate()": SimpleForwardingField,
}
PREFLIGHT_QUERY_COLUMNS = {"release.timestamp"}
VirtualOrderByName = Literal["release.timestamp"]


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

    conditions = query.get_filter_conditions()

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

    project_ids = query.params["project_id"]
    limit = Limit(query.limit) if query.limit else None

    ordered_preflight_filters: dict[GroupByFieldName, Sequence[str]] = {}
    try:
        orderby = _parse_orderby(query, fields)
    except NonPreflightOrderByException:
        # We hit this branch when we suspect that the orderBy columns is one of the virtual
        # columns like `release.timestamp` that require a preflight query to be run, and so we
        # check here if it is one of the supported preflight query columns and if so we run the
        # preflight query. Otherwise we re-raise the exception
        raw_orderby = query.raw_orderby[0]
        if raw_orderby[0] == "-":
            raw_orderby = raw_orderby[1:]
            direction = Direction.DESC
        else:
            direction = Direction.ASC

        if raw_orderby not in PREFLIGHT_QUERY_COLUMNS:
            raise
        else:
            if raw_orderby == "release.timestamp" and "release" not in query.raw_groupby:
                raise InvalidParams(
                    "To sort by release.timestamp, tag release must be in the groupBy"
                )

            if query.offset and query.offset > 0:
                raise InvalidParams(
                    f"Passing an offset value greater than 0 when ordering by {raw_orderby} is "
                    f"not permitted"
                )

            if query.limit is not None:
                if query.limit > MAX_POSTGRES_LIMIT:
                    raise InvalidParams(
                        f"This limit is too high for queries that requests a preflight query. "
                        f"Please choose a limit below {MAX_POSTGRES_LIMIT}"
                    )
                limit = Limit(query.limit)
            else:
                limit = Limit(MAX_POSTGRES_LIMIT)

        preflight_query_conditions = {
            "orderby_field": raw_orderby,
            "direction": direction,
            "org_id": org_id,
            "project_ids": project_ids,
            "limit": limit,
        }

        # For preflight queries, we need to evaluate environment conditions because these might
        # be used in the preflight query. Example when we sort by `-release.timestamp`, and when
        # we have environment filters applied to the query, then we need to include the
        # environment filters otherwise we might end up with metrics queries filters that do not
        # belong to the same environment
        environment_conditions = []
        for condition in where:
            preflight_query_condition = _get_filters_for_preflight_query_condition(
                tag_name="environment", condition=condition
            )
            if preflight_query_condition != (None, None):
                environment_conditions.append(preflight_query_condition)

        if len(environment_conditions) > 1:
            # Should never hit this branch. Added as a fail safe
            raise InvalidParams("Environment condition was parsed incorrectly")
        else:
            try:
                preflight_query_conditions.update({"env_condition": environment_conditions[0]})
            except IndexError:
                pass

        preflight_query_filters = _generate_preflight_query_conditions(**preflight_query_conditions)

        if len(preflight_query_filters) == 0:
            # If we get no results from the pre-flight query that are supposed to be used as a
            # filter in the metrics query, then there is no point in running the metrics query
            return _empty_result(query)

        condition_lhs: GroupByFieldName | None = None
        if raw_orderby == "release.timestamp":
            condition_lhs = "release"
            ordered_preflight_filters[condition_lhs] = preflight_query_filters

        if condition_lhs is not None:
            where += [Condition(Column(condition_lhs), Op.IN, preflight_query_filters)]

        # Clear OrderBy because query is already filtered and we will re-order the results
        # according to the order of the filter list later on
        orderby = None

    else:
        if orderby is None:
            # We only return the top-N groups, based on the first field that is being
            # queried, assuming that those are the most relevant to the user.
            primary_metric_field = _get_primary_field(list(fields.values()), query.raw_groupby)
            orderby = MetricOrderByField(field=primary_metric_field, direction=Direction.DESC)

    orderby_sequence = None
    if orderby is not None:
        orderby_sequence = [orderby]

    metrics_query = DeprecatingMetricsQuery(
        org_id=org_id,
        project_ids=project_ids,
        select=list({column for field in fields.values() for column in field.metric_fields}),
        granularity=Granularity(query.rollup),
        start=query.start,
        end=query.end,
        where=where,
        groupby=list(
            {
                MetricGroupByField(column)
                for field in fields.values()
                for column in field.get_groupby()
            }
        ),
        orderby=orderby_sequence,
        limit=limit,
        offset=Offset(query.offset or 0),
    )

    # TODO: Stop passing project IDs everywhere
    projects = Project.objects.get_many_from_cache(project_ids)
    try:
        metrics_results = get_series(
            projects,
            metrics_query,
            use_case_id=UseCaseID.SESSIONS,
            tenant_ids={"organization_id": org_id},
        )
    except OrderByNotSupportedOverCompositeEntityException:
        raise InvalidParams(f"Cannot order by {query.raw_orderby[0]} with the current filters")

    input_groups = {
        GroupKey.from_input_dict(group["by"]): group for group in metrics_results["groups"]
    }

    default_group_gen_func: Callable[[], Group] = lambda: {
        "totals": {field: default_for(field) for field in query.raw_fields},
        "series": {
            field: len(metrics_results["intervals"]) * [default_for(field)]
            for field in query.raw_fields
        },
    }

    output_groups: MutableMapping[GroupKey, Group] = defaultdict(default_group_gen_func)

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

    result_groups: Sequence[SessionsQueryGroup] = [
        # Convert group keys back to dictionaries:
        {"by": group_key.to_output_dict(), **group}  # type: ignore[typeddict-item]
        for group_key, group in output_groups.items()
    ]
    result_groups = _order_by_preflight_query_results(
        ordered_preflight_filters, query.raw_groupby, result_groups, default_group_gen_func, limit
    )

    return {
        "groups": result_groups,
        "start": isoformat_z(metrics_results["start"]),
        "end": isoformat_z(metrics_results["end"]),
        "intervals": [isoformat_z(ts) for ts in metrics_results["intervals"]],
        "query": query.query,
    }


def _order_by_preflight_query_results(
    ordered_preflight_filters: dict[GroupByFieldName, Sequence[str]],
    groupby: GroupByFieldName,
    result_groups: Sequence[SessionsQueryGroup],
    default_group_gen_func: Callable[[], Group],
    limit: Limit,
) -> Sequence[SessionsQueryGroup]:
    """
    If a preflight query was run, then we want to preserve the order of results
    returned by the preflight query
    We create a mapping between the group value to the result group, so we are able
    to easily sort the resulting groups.
    For example, if we are ordering by `-release.timestamp`, we might get from
    postgres a list of results ['1B', '1A'], and results from metrics dataset
    [
        {
            "by": {"release": "1A"},
            "totals": {"sum(session)": 0},
            "series": {"sum(session)": [0]},
        },
        {
            "by": {"release": "1B"},
            "totals": {"sum(session)": 10},
            "series": {"sum(session)": [10]},
        },
    ]
    Then we create a mapping from release value to the result group:
    {
        "1A": [
            {
                "by": {"release": "1A"},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0]},
            },
        ],
        "1B": [
            {
                "by": {"release": "1B"},
                "totals": {"sum(session)": 10},
                "series": {"sum(session)": [10]},
            },
        ],
    }
    Then loop over the releases list sequentially, and rebuild the result_groups
    array based on that order by appending to the list the values from that mapping
    and accessing it through the key which is the group value
    """
    if len(ordered_preflight_filters) == 1:
        orderby_field = list(ordered_preflight_filters.keys())[0]
        grp_value_to_result_grp_mapping: dict[int | str, list[SessionsQueryGroup]] = {}

        for result_group in result_groups:
            grp_value = result_group["by"][orderby_field]
            grp_value_to_result_grp_mapping.setdefault(grp_value, []).append(result_group)
        result_groups = []
        for elem in ordered_preflight_filters[orderby_field]:
            try:
                for grp in grp_value_to_result_grp_mapping[elem]:
                    result_groups += [grp]
            except KeyError:
                # We get into this branch if there are groups in the preflight query that do
                # not have matching data in the metrics dataset, and since we want to show
                # those groups in the output, we add them but null out the fields requested
                # This could occur for example, when ordering by `-release.timestamp` and
                # some of the latest releases in Postgres do not have matching data in
                # metrics dataset
                group_key_dict = {orderby_field: elem}
                for key in groupby:
                    if key == orderby_field:
                        continue
                    # Added a mypy ignore here because this is a one off as result groups
                    # will never have null group values except when the group exists in the
                    # preflight query but not in the metrics dataset
                    group_key_dict.update({key: None})  # type: ignore[dict-item]
                result_groups += [{"by": group_key_dict, **default_group_gen_func()}]

        # Pop extra groups returned to match request limit
        if len(result_groups) > limit.limit:
            result_groups = result_groups[: limit.limit]
    return result_groups


def _empty_result(query: QueryDefinition) -> SessionsQueryResult:
    intervals = get_timestamps(query)
    return {
        "groups": [],
        "start": query.start,
        "end": query.end,
        "intervals": intervals,
        "query": query.query,
    }


def _extract_status_filter_from_conditions(
    conditions: ConditionGroup,
) -> tuple[ConditionGroup, StatusFilter]:
    """Split conditions into metrics conditions and a filter on session.status"""
    if not conditions:
        return conditions, None
    where_values = []
    status_values = []
    for condition in conditions:
        cand_where, cand_status = _transform_single_condition(condition)
        if cand_where is not None:
            where_values.append(cand_where)
        if cand_status is not None:
            status_values.append(cand_status)

    return where_values, frozenset.intersection(*status_values) if status_values else None


def _transform_single_condition(
    condition: Condition | BooleanCondition,
) -> tuple[Condition | BooleanCondition | None, StatusFilter]:
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


def _get_filters_for_preflight_query_condition(
    tag_name: str, condition: Condition | BooleanCondition
) -> tuple[Op | None, set[str] | None]:
    """
    Function that takes a tag name and a condition, and checks if that condition is for that tag
    and if so returns a tuple of the op applied either Op.IN or Op.NOT_IN and a set of the tag
    values
    """
    if isinstance(condition, Condition) and condition.lhs == Column(tag_name):
        if condition.op in [Op.EQ, Op.NEQ, Op.IN, Op.NOT_IN]:
            filters = (
                {condition.rhs}
                if isinstance(condition.rhs, str)
                else {elem for elem in condition.rhs}
            )
            op = {Op.EQ: Op.IN, Op.IN: Op.IN, Op.NEQ: Op.NOT_IN, Op.NOT_IN: Op.NOT_IN}[condition.op]
            return op, filters
        raise InvalidParams(
            f"Unable to resolve {tag_name} filter due to unsupported op {condition.op}"
        )

    if tag_name in str(condition):
        # Anything not handled by the code above cannot be parsed for now,
        # for two reasons:
        # 1) Queries like session.status:healthy OR release:foo are hard to
        #    translate, because they would require different conditions on the separate
        #    metric fields.
        # 2) AND and OR conditions come in the form `Condition(Function("or", [...]), Op.EQ, 1)`
        #    where [...] can again contain any condition encoded as a Function. For this, we would
        #    have to replicate the translation code above.
        raise InvalidParams(f"Unable to parse condition with {tag_name}")
    return None, None


def _parse_session_status(status: Any) -> frozenset[SessionStatus]:
    try:
        return frozenset([SessionStatus(status)])
    except ValueError:
        return frozenset()


def _parse_orderby(
    query: QueryDefinition, fields: Mapping[SessionsQueryFunction, Field]
) -> MetricOrderByField | None:
    orderbys = query.raw_orderby
    if orderbys == []:
        return None

    # ToDo(ahmed): We might want to enable multi field ordering if some of the fields ordered by
    #  are generated from pre-flight queries, and thereby are popped from metrics queries,
    #  but I though it might be confusing behavior so restricting it for now.
    if len(orderbys) > 1:
        raise InvalidParams("Cannot order by multiple fields")
    orderby = orderbys[0]

    if "session.status" in query.raw_groupby:
        # We can allow grouping by `session.status` when having an orderBy column to be a field
        # that if the orderBy columns is one of the virtual columns that indicates that a preflight
        # query (like `release.timestamp`) needs to be run to evaluate the query, and so we raise an
        # instance of `NonPreflightOrderByException` and delegate handling this case to the
        # `run_sessions_query` function
        raise NonPreflightOrderByException("Cannot use 'orderBy' when grouping by sessions.status")

    direction = Direction.ASC
    if orderby[0] == "-":
        orderby = orderby[1:]
        direction = Direction.DESC

    assert query.raw_fields
    if orderby not in query.raw_fields:
        # We can allow orderBy column to be a field that is not requested in the select
        # statements if it is one of the virtual columns that indicated a preflight query needs
        # to be run to evaluate the query, and so we raise an instance of
        # `NonPreflightOrderByException` and delegate handling this case to the
        # `run_sessions_query` function
        raise NonPreflightOrderByException("'orderBy' must be one of the provided 'fields'")

    field = fields[orderby]

    if len(field.metric_fields) != 1:
        # This can still happen when we filter by session.status
        raise InvalidParams(f"Cannot order by {field.name} with the current filters")

    return MetricOrderByField(field.metric_fields[0], direction)


def _get_primary_field(fields: Sequence[Field], raw_groupby: Sequence[str]) -> MetricField:
    """Determine the field by which results will be ordered in case there is no orderBy"""
    primary_metric_field = None
    for i, field in enumerate(fields):
        if i == 0 or field.name == "sum(session)":
            primary_metric_field = field.metric_fields[0]

    assert primary_metric_field
    return primary_metric_field


def _generate_preflight_query_conditions(
    orderby_field: VirtualOrderByName,
    direction: Direction,
    org_id: int,
    project_ids: Sequence[ProjectId],
    limit: Limit,
    env_condition: tuple[Op, set[str]] | None = None,
) -> Sequence[str]:
    """
    Function that fetches the preflight query filters that need to be applied to the subsequent
    metrics query
    """
    queryset_results = []
    if orderby_field == "release.timestamp":
        queryset = Release.objects.filter(
            organization=org_id,
            projects__id__in=project_ids,
        )
        if env_condition is not None:
            op, env_filter_set = env_condition
            environment_orm_conditions = {
                "releaseprojectenvironment__environment__name__in": env_filter_set,
                "releaseprojectenvironment__project_id__in": project_ids,
            }
            if op == Op.IN:
                queryset = queryset.filter(**environment_orm_conditions)
            else:
                assert op == Op.NOT_IN
                queryset = queryset.exclude(**environment_orm_conditions)

        if direction == Direction.DESC:
            queryset = queryset.order_by("-date_added", "-id")
        else:
            queryset = queryset.order_by("date_added", "id")

        queryset_results = list(queryset[: limit.limit].values_list("version", flat=True))
    return queryset_results
