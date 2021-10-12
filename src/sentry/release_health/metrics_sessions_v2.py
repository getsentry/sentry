""" This module offers the same functionality as sessions_v2, but pulls its data
from the `metrics` dataset instead of `sessions`.

Do not call this module directly. Use the `release_health` service instead. """
import abc
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import datetime
from typing import (
    Any,
    Generator,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Set,
    Tuple,
    Union,
    cast,
)

from snuba_sdk import Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.legacy import json_to_snql
from typing_extensions import Literal, TypedDict

from sentry.release_health.base import (
    GroupByFieldName,
    SessionsQueryFunction,
    SessionsQueryGroup,
    SessionsQueryResult,
    SessionsQueryValue,
)
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics import TS_COL_GROUP, TS_COL_QUERY, get_intervals
from sentry.snuba.sessions_v2 import QueryDefinition, finite_or_none
from sentry.utils.snuba import raw_snql_query

#: Referrers for snuba queries
#: Referrers must be searchable, so no string interpolation here
REFERRERS = {
    "user": {
        "series": "release_health.metrics.sessions_v2.user.series",
        "totals": "release_health.metrics.sessions_v2.user.totals",
    },
    "session.duration": {
        "series": "release_health.metrics.sessions_v2.session.duration.series",
        "totals": "release_health.metrics.sessions_v2.session.duration.totals",
    },
    "session": {
        "series": "release_health.metrics.sessions_v2.session.series",
        "totals": "release_health.metrics.sessions_v2.session.totals",
    },
    "session.error": {
        "series": "release_health.metrics.sessions_v2.session.error.series",
        "totals": "release_health.metrics.sessions_v2.session.error.totals",
    },
}


def _resolve(name: str) -> Optional[int]:
    """Wrapper for typing"""
    return indexer.resolve(name)  # type: ignore


def _resolve_ensured(name: str) -> int:
    """Assume the index entry exists"""
    index = _resolve(name)
    assert index is not None
    return index


def _reverse_resolve(index: int) -> Optional[str]:
    """Wrapper for typing"""
    return indexer.reverse_resolve(index)  # type: ignore


def _reverse_resolve_ensured(index: int) -> str:
    """Assume the index entry exists"""
    string = _reverse_resolve(index)
    assert string is not None
    return string


_SessionStatus = Literal[
    "abnormal",
    "crashed",
    "errored",
    "healthy",
]


@dataclass(frozen=True)
class _SessionStatusValue:
    """A data value associated with a certain session status"""

    session_status: Optional[_SessionStatus]
    value: Union[None, float, int]


_MetricName = Literal["session", "session.duration", "session.error", "user"]


#: Actual column name in snuba
_SnubaColumnName = Literal["value", "avg", "max", "percentiles"]

#: "Virtual" column name, almost the same as _SnubaColumnName,
#: but "percentiles" is expanded into multiple columns later on
_VirtualColumnName = Literal["value", "avg", "max", "p50", "p75", "p90", "p95", "p99"]


@dataclass(frozen=True)
class _DataPointKey:
    """A key to access a data point in _DataPoints.

    `_fetch_data` collects multiple snuba query results, which return their data
    in rows. To facilitate the transformation to the desired output format,
    `_flatten_data` stores all snuba results in a flat key-value-map.

    Example: The snuba query

        MATCH (metrics_distributions) SELECT avg, max BY bucketed_time ...

    would result in data keys

        metric_name=session.duration, column=avg, bucketed_time=<datetime1>
        metric_name=session.duration, column=max, bucketed_time=<datetime1>
        metric_name=session.duration, column=avg, bucketed_time=<datetime2>
        metric_name=session.duration, column=max, bucketed_time=<datetime2>
        ...

    """

    metric_name: _MetricName
    raw_session_status: Optional[str] = None
    release: Optional[int] = None
    environment: Optional[int] = None
    bucketed_time: Optional[datetime] = None
    column: _VirtualColumnName = "value"
    project_id: Optional[int] = None


_DataPoints = MutableMapping[_DataPointKey, float]
_SnubaData = Sequence[MutableMapping[str, Any]]
_SnubaDataByMetric = Sequence[Tuple[_MetricName, _SnubaData]]


class _OutputField(abc.ABC):
    @abc.abstractmethod
    def get_name(self) -> SessionsQueryFunction:
        pass

    def get_values(
        self, data_points: _DataPoints, key: _DataPointKey
    ) -> Sequence[_SessionStatusValue]:
        """List values by session.status"""
        return [_SessionStatusValue(None, data_points[key])]


class _UserField(_OutputField):
    def get_name(self) -> SessionsQueryFunction:
        return "count_unique(user)"

    def get_values(
        self, data_points: _DataPoints, key: _DataPointKey
    ) -> Sequence[_SessionStatusValue]:
        if key.raw_session_status is None:
            return [_SessionStatusValue(None, int(data_points[key]))]

        if key.raw_session_status == "init":
            # sessions_v2 always shows all session statuses (even if they have a count of 0),
            # So let's hardcode them here
            started = int(data_points[key])
            abnormal = int(data_points.get(replace(key, raw_session_status="abnormal"), 0))
            crashed = int(data_points.get(replace(key, raw_session_status="crashed"), 0))
            all_errored = int(data_points.get(replace(key, raw_session_status="errored"), 0))

            healthy = max(0, started - all_errored)
            errored = max(0, all_errored - abnormal - crashed)

            return [
                _SessionStatusValue("abnormal", abnormal),
                _SessionStatusValue("crashed", crashed),
                _SessionStatusValue("errored", errored),
                _SessionStatusValue("healthy", healthy),
            ]

        # The "init" branch generates values for all statuses, so nothing
        # to do here:
        return []


class _SumSessionField(_OutputField):
    def get_name(self) -> SessionsQueryFunction:
        return "sum(session)"

    def get_values(
        self, data_points: _DataPoints, key: _DataPointKey
    ) -> Sequence[_SessionStatusValue]:
        if key.raw_session_status is None:
            return [_SessionStatusValue(None, int(data_points[key]))]

        if key.raw_session_status == "init":
            # sessions_v2 always shows all session statuses (even if they have a count of 0),
            # So let's hardcode them here
            started = int(data_points[key])
            abnormal = int(data_points.get(replace(key, raw_session_status="abnormal"), 0))
            crashed = int(data_points.get(replace(key, raw_session_status="crashed"), 0))
            errored_key = replace(key, metric_name="session.error", raw_session_status=None)
            all_errored = int(data_points.get(errored_key, 0))

            healthy = max(0, started - all_errored)
            errored = max(0, all_errored - abnormal - crashed)

            return [
                _SessionStatusValue("abnormal", abnormal),
                _SessionStatusValue("crashed", crashed),
                _SessionStatusValue("errored", errored),
                _SessionStatusValue("healthy", healthy),
            ]

        # The "init" branch generates values for all statuses, so nothing
        # to do here:
        return []


class _SessionDurationField(_OutputField):
    def __init__(
        self, name: SessionsQueryFunction, column: _VirtualColumnName, group_by_status: bool
    ) -> None:
        self._name = name
        self._column = column

        self.group_by_status = group_by_status

    def get_name(self) -> SessionsQueryFunction:
        return self._name

    def get_values(
        self, data_points: _DataPoints, key: _DataPointKey
    ) -> Sequence[_SessionStatusValue]:
        assert key.raw_session_status is None, key  # session.duration does not have status tag
        value = 1000.0 * data_points[key]  # sessions backend stores milliseconds
        if self.group_by_status:
            # Only 'healthy' sessions have duration data:
            return [
                _SessionStatusValue("abnormal", None),
                _SessionStatusValue("crashed", None),
                _SessionStatusValue("errored", None),
                _SessionStatusValue("healthy", value),
            ]
        else:
            return [
                _SessionStatusValue(None, value),
            ]


def _get_snuba_query(
    org_id: int,
    query: QueryDefinition,
    entity_key: EntityKey,
    metric_id: int,
    columns: Sequence[str],
    series: bool,
    extra_conditions: List[Condition],
    remove_groupby: Set[Column],
) -> Query:
    """Build the snuba query"""
    conditions = [
        Condition(Column("org_id"), Op.EQ, org_id),
        Condition(Column("project_id"), Op.IN, query.filter_keys["project_id"]),
        Condition(Column("metric_id"), Op.EQ, metric_id),
        Condition(Column(TS_COL_QUERY), Op.GTE, query.start),
        Condition(Column(TS_COL_QUERY), Op.LT, query.end),
    ]
    conditions += _get_filter_conditions(org_id, query.conditions)
    conditions += extra_conditions

    groupby_tags = [field for field in query.raw_groupby if field != "project"]

    tag_keys = {field: _resolve(field) for field in groupby_tags}
    groupby = {
        field: Column(f"tags[{tag_id}]")
        for field, tag_id in tag_keys.items()
        if tag_id is not None  # exclude unresolved keys from groupby
    }

    if "project" in query.raw_groupby:
        groupby["project"] = Column("project_id")

    full_groupby = set(groupby.values()) - remove_groupby
    if series:
        full_groupby.add(Column(TS_COL_GROUP))

    return Query(
        dataset=Dataset.Metrics.value,
        match=Entity(entity_key.value),
        select=[Column(column) for column in columns],
        groupby=list(full_groupby),
        where=conditions,
        granularity=Granularity(query.rollup),
    )


def _get_snuba_query_data(
    org_id: int,
    query: QueryDefinition,
    entity_key: EntityKey,
    metric_name: _MetricName,
    metric_id: int,
    columns: Sequence[str],
    extra_conditions: Optional[List[Condition]] = None,
    remove_groupby: Optional[Set[Column]] = None,
) -> Generator[Tuple[_MetricName, _SnubaData], None, None]:
    """Get data from snuba"""
    if extra_conditions is None:
        extra_conditions = []

    if remove_groupby is None:
        remove_groupby = set()

    for query_type in ("series", "totals"):
        snuba_query = _get_snuba_query(
            org_id,
            query,
            entity_key,
            metric_id,
            columns,
            series=query_type == "series",
            extra_conditions=extra_conditions,
            remove_groupby=remove_groupby,
        )
        referrer = REFERRERS[metric_name][query_type]
        query_data = raw_snql_query(snuba_query, referrer=referrer)["data"]

        yield (metric_name, query_data)


def _fetch_data(
    org_id: int,
    query: QueryDefinition,
) -> Tuple[_SnubaDataByMetric, Mapping[Tuple[_MetricName, _VirtualColumnName], _OutputField]]:
    """Build & run necessary snuba queries"""

    # It greatly simplifies code if we just assume that these two tags exist:
    # TODO: Can we get away with that assumption?
    tag_key_session_status = _resolve_ensured("session.status")

    data: List[Tuple[_MetricName, _SnubaData]] = []

    #: Find the field that needs a specific column in a specific metric
    metric_to_output_field: MutableMapping[
        Tuple[_MetricName, _VirtualColumnName], _OutputField
    ] = {}

    if "count_unique(user)" in query.raw_fields:
        metric_id = _resolve("user")
        if metric_id is not None:
            data.extend(
                _get_snuba_query_data(
                    org_id, query, EntityKey.MetricsSets, "user", metric_id, ["value"]
                )
            )
            metric_to_output_field[("user", "value")] = _UserField()

    duration_fields = [field for field in query.raw_fields if "session.duration" in field]
    if duration_fields:
        metric_id = _resolve("session.duration")
        if metric_id is not None:

            def get_virtual_column(field: SessionsQueryFunction) -> _VirtualColumnName:
                return cast(_VirtualColumnName, field[:3])

            def get_snuba_column(field: SessionsQueryFunction) -> _SnubaColumnName:
                """Get the actual snuba column needed by this function"""
                virtual_column = get_virtual_column(field)
                if virtual_column in ("p50", "p75", "p90", "p95", "p99"):
                    return "percentiles"

                return cast(_SnubaColumnName, virtual_column)

            snuba_columns = {get_snuba_column(field) for field in duration_fields}

            # sessions_v2 only exposes healthy session's durations
            healthy = _resolve("exited")
            extra_conditions = [
                Condition(Column(f"tags[{tag_key_session_status}]"), Op.EQ, healthy)
            ]
            remove_groupby = {Column(f"tags[{tag_key_session_status}]")}

            if tag_key_session_status is not None and healthy is not None:
                data.extend(
                    _get_snuba_query_data(
                        org_id,
                        query,
                        EntityKey.MetricsDistributions,
                        "session.duration",
                        metric_id,
                        list(snuba_columns),
                        extra_conditions=extra_conditions,
                        remove_groupby=remove_groupby,
                    )
                )
                group_by_status = "session.status" in query.raw_groupby
                for field in duration_fields:
                    col = get_virtual_column(field)
                    metric_to_output_field[("session.duration", col)] = _SessionDurationField(
                        field, col, group_by_status
                    )

    if "sum(session)" in query.raw_fields:
        metric_id = _resolve("session")
        if metric_id is not None:
            if "session.status" in query.raw_groupby:
                # We need session counters grouped by status, as well as the number of errored sessions

                # 1 session counters
                data.extend(
                    _get_snuba_query_data(
                        org_id, query, EntityKey.MetricsCounters, "session", metric_id, ["value"]
                    )
                )

                # 2: session.error
                error_metric_id = _resolve("session.error")
                if error_metric_id is not None:
                    remove_groupby = {Column(f"tags[{tag_key_session_status}]")}
                    data.extend(
                        _get_snuba_query_data(
                            org_id,
                            query,
                            EntityKey.MetricsSets,
                            "session.error",
                            error_metric_id,
                            ["value"],
                            remove_groupby=remove_groupby,
                        )
                    )
            else:
                # Simply count the number of started sessions:
                init = _resolve("init")
                if tag_key_session_status is not None and init is not None:
                    extra_conditions = [
                        Condition(Column(f"tags[{tag_key_session_status}]"), Op.EQ, init)
                    ]
                    data.extend(
                        _get_snuba_query_data(
                            org_id,
                            query,
                            EntityKey.MetricsCounters,
                            "session",
                            metric_id,
                            ["value"],
                            extra_conditions,
                        )
                    )

            metric_to_output_field[("session", "value")] = _SumSessionField()

    return data, metric_to_output_field


def _flatten_data(org_id: int, data: _SnubaDataByMetric) -> _DataPoints:
    """Unite snuba data from multiple queries into a single key-value map for easier access"""
    data_points = {}

    # It greatly simplifies code if we just assume that these two tags exist:
    # TODO: Can we get away with that assumption?
    tag_key_release = _resolve_ensured("release")
    tag_key_environment = _resolve_ensured("environment")
    tag_key_session_status = _resolve_ensured("session.status")

    for metric_name, metric_data in data:
        for row in metric_data:
            raw_session_status = row.pop(f"tags[{tag_key_session_status}]", None)
            if raw_session_status is not None:
                raw_session_status = _reverse_resolve_ensured(raw_session_status)
            flat_key = _DataPointKey(
                metric_name=metric_name,
                raw_session_status=raw_session_status,
                release=row.pop(f"tags[{tag_key_release}]", None),
                environment=row.pop(f"tags[{tag_key_environment}]", None),
                bucketed_time=row.pop("bucketed_time", None),
                project_id=row.pop("project_id", None),
            )

            # Percentile column expands into multiple "virtual" columns:
            if "percentiles" in row:
                # TODO: Use percentile enum
                percentiles = row.pop("percentiles")
                for i, percentile in enumerate(["p50", "p75", "p90", "p95", "p99"]):
                    percentile_key = replace(flat_key, column=percentile)
                    data_points[percentile_key] = percentiles[i]

            # Remaining data are simple columns:
            for key in list(row.keys()):
                assert key in ("avg", "max", "value")
                data_points[replace(flat_key, column=key)] = row.pop(key)

            assert row == {}

    return data_points


def run_sessions_query(
    org_id: int,
    query: QueryDefinition,
    span_op: str,
) -> SessionsQueryResult:
    """Convert a QueryDefinition to multiple snuba queries and reformat the results"""
    data, metric_to_output_field = _fetch_data(org_id, query)

    data_points = _flatten_data(org_id, data)

    intervals = list(get_intervals(query))
    timestamp_index = {timestamp.isoformat(): index for index, timestamp in enumerate(intervals)}

    def default_for(field: SessionsQueryFunction) -> SessionsQueryValue:
        return 0 if field in ("sum(session)", "count_unique(user)") else None

    GroupKey = Tuple[Tuple[GroupByFieldName, Union[str, int]], ...]

    class Group(TypedDict):
        series: MutableMapping[SessionsQueryFunction, List[SessionsQueryValue]]
        totals: MutableMapping[SessionsQueryFunction, SessionsQueryValue]

    groups: MutableMapping[GroupKey, Group] = defaultdict(
        lambda: {
            "totals": {field: default_for(field) for field in query.raw_fields},
            "series": {field: len(intervals) * [default_for(field)] for field in query.raw_fields},
        }
    )

    for key in data_points.keys():
        try:
            output_field = metric_to_output_field[key.metric_name, key.column]
        except KeyError:
            continue  # secondary metric, like session.error

        by: MutableMapping[GroupByFieldName, Union[str, int]] = {}
        if key.release is not None:
            # Note: If the tag value reverse-resolves to None here, it's a bug in the tag indexer
            by["release"] = _reverse_resolve_ensured(key.release)
        if key.environment is not None:
            by["environment"] = _reverse_resolve_ensured(key.environment)
        if key.project_id is not None:
            by["project"] = key.project_id

        for status_value in output_field.get_values(data_points, key):
            if status_value.session_status is not None:
                by["session.status"] = status_value.session_status

            group_key: GroupKey = tuple(sorted(by.items()))
            group = groups[group_key]

            value = status_value.value
            if value is not None:
                value = finite_or_none(value)

            if key.bucketed_time is None:
                group["totals"][output_field.get_name()] = value
            else:
                index = timestamp_index[key.bucketed_time]
                group["series"][output_field.get_name()][index] = value

    groups_as_list: List[SessionsQueryGroup] = [
        {
            "by": dict(by),
            "totals": group["totals"],
            "series": group["series"],
        }
        for by, group in groups.items()
    ]

    def format_datetime(dt: datetime) -> str:
        return dt.isoformat().replace("+00:00", "Z")

    return {
        "start": format_datetime(query.start),
        "end": format_datetime(query.end),
        "query": query.query,
        "intervals": [format_datetime(dt) for dt in intervals],
        "groups": groups_as_list,
    }


def _get_filter_conditions(org_id: int, conditions: Sequence[Condition]) -> Any:
    """Translate given conditions to snql"""
    dummy_entity = EntityKey.MetricsSets.value
    filter_conditions = json_to_snql(
        {"selected_columns": ["value"], "conditions": conditions}, entity=dummy_entity
    ).where
    return _translate_conditions(org_id, filter_conditions)


def _translate_conditions(org_id: int, input_: Any) -> Any:
    if isinstance(input_, Column):
        # The only filterable tag keys are release and environment.
        assert input_.name in ("release", "environment")
        # It greatly simplifies code if we just assume that they exist.
        # Alternative would be:
        #   * if tag key or value does not exist in AND-clause, return no data
        #   * if tag key or value does not exist in OR-clause, remove condition
        tag_key = _resolve_ensured(input_.name)

        return Column(f"tags[{tag_key}]")

    if isinstance(input_, str):
        # Assuming this is the right-hand side, we need to fetch a tag value.
        # It's OK if the tag value resolves to None, the snuba query will then
        # return no results, as is intended behavior

        return _resolve(input_)

    if isinstance(input_, Function):

        return Function(
            function=input_.function, parameters=_translate_conditions(org_id, input_.parameters)
        )

    if isinstance(input_, Condition):

        return Condition(
            lhs=_translate_conditions(org_id, input_.lhs),
            op=input_.op,
            rhs=_translate_conditions(org_id, input_.rhs),
        )

    if isinstance(input_, (int, float)):

        return input_

    assert isinstance(input_, list), input_
    return [_translate_conditions(org_id, item) for item in input_]
