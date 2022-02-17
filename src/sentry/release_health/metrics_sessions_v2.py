""" This module offers the same functionality as sessions_v2, but pulls its data
from the `metrics` dataset instead of `sessions`.

Do not call this module directly. Use the `release_health` service instead. """
import abc
import logging
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass, replace
from datetime import datetime
from typing import (
    Any,
    Collection,
    Generator,
    List,
    Literal,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Set,
    Tuple,
    TypedDict,
    Union,
    cast,
)

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    Op,
    OrderBy,
    Query,
)
from snuba_sdk.legacy import json_to_snql
from snuba_sdk.query import SelectableExpression

from sentry.release_health.base import (
    GroupByFieldName,
    SessionsQueryFunction,
    SessionsQueryGroup,
    SessionsQueryResult,
    SessionsQueryValue,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.sessions import SessionMetricKey as MetricKey
from sentry.sentry_metrics.utils import (
    MetricIndexNotFound,
    resolve_tag_key,
    reverse_resolve,
    reverse_resolve_weak,
)
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics import TS_COL_GROUP, TS_COL_QUERY, get_intervals
from sentry.snuba.sessions_v2 import SNUBA_LIMIT, QueryDefinition, finite_or_none, get_timestamps
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

#: Referrers for snuba queries
#: Referrers must be searchable, so no string interpolation here
REFERRERS = {
    MetricKey.USER: {
        "series": "release_health.metrics.sessions_v2.user.series",
        "totals": "release_health.metrics.sessions_v2.user.totals",
    },
    MetricKey.SESSION_DURATION: {
        "series": "release_health.metrics.sessions_v2.session.duration.series",
        "totals": "release_health.metrics.sessions_v2.session.duration.totals",
    },
    MetricKey.SESSION: {
        "series": "release_health.metrics.sessions_v2.session.series",
        "totals": "release_health.metrics.sessions_v2.session.totals",
    },
    MetricKey.SESSION_ERROR: {
        "series": "release_health.metrics.sessions_v2.session.error.series",
        "totals": "release_health.metrics.sessions_v2.session.error.totals",
    },
}


_SessionStatus = Literal[
    "abnormal",
    "crashed",
    "errored",
    "healthy",
]

_DURATION_PERCENTILES = (
    "p50(session.duration)",
    "p75(session.duration)",
    "p90(session.duration)",
    "p95(session.duration)",
    "p99(session.duration)",
)

_DURATION_FIELDS = (
    "avg(session.duration)",
    "max(session.duration)",
) + _DURATION_PERCENTILES


@dataclass(frozen=True)
class _SessionStatusValue:
    """A data value associated with a certain session status"""

    session_status: Optional[_SessionStatus]
    value: Union[None, float, int]


#: "Virtual" column name, almost the same as _SnubaColumnName,
#: but "percentiles" is expanded into multiple columns later on
_VirtualColumnName = Literal["value", "avg", "max", "p50", "p75", "p90", "p95", "p99"]


def _to_column(
    query_func: SessionsQueryFunction, column_condition: SelectableExpression = 1
) -> SelectableExpression:
    """
    Converts query a function into an expression that can be directly plugged into anywhere
    columns are used (like the select argument of a Query)
    """

    parameters = (Column("value"), column_condition)

    # distribution columns
    if query_func in _DURATION_PERCENTILES:
        return Function(
            alias="percentiles",
            function="quantilesIf(0.5,0.75,0.9,0.95,0.99)",
            parameters=parameters,
        )
    if query_func == "avg(session.duration)":
        return Function(
            alias="avg",
            function="avgIf",
            parameters=parameters,
        )
    if query_func == "max(session.duration)":
        return Function(
            alias="max",
            function="maxIf",
            parameters=parameters,
        )
    # counters
    if query_func == "sum(session)":
        return Function(
            alias="sum",
            function="sumIf",
            parameters=parameters,
        )
    # sets
    if query_func == "count_unique(user)":
        return Function(
            alias="count_unique",
            function="uniqIf",
            parameters=parameters,
        )

    raise ValueError("Unmapped metrics column", query_func)


@dataclass(frozen=True)
class _DataPointKey:
    """A key to access a data point in _DataPoints.

    `_fetch_data` collects multiple snuba query results, which return their data
    in rows. To facilitate the transformation to the desired output format,
    `_flatten_data` stores all snuba results in a flat key-value-map.

    Example: The snuba query

        MATCH (metrics_distributions) SELECT avg, max BY bucketed_time ...

    would result in data keys

        metric_key=MetricKey.SESSION_DURATION, column=avg, bucketed_time=<datetime1>
        metric_key=MetricKey.SESSION_DURATION, column=max, bucketed_time=<datetime1>
        metric_key=MetricKey.SESSION_DURATION, column=avg, bucketed_time=<datetime2>
        metric_key=MetricKey.SESSION_DURATION, column=max, bucketed_time=<datetime2>
        ...

    """

    metric_key: MetricKey
    raw_session_status: Optional[str] = None
    release: Optional[int] = None
    environment: Optional[int] = None
    bucketed_time: Optional[datetime] = None
    column: _VirtualColumnName = "value"
    project_id: Optional[int] = None


_DataPoints = MutableMapping[_DataPointKey, float]
_SnubaData = Sequence[MutableMapping[str, Any]]
_SnubaDataByMetric = List[Tuple[MetricKey, _SnubaData]]


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
            errored_key = replace(key, metric_key=MetricKey.SESSION_ERROR, raw_session_status=None)
            individual_errors = int(data_points.get(errored_key, 0))
            aggregated_errors = int(
                data_points.get(replace(key, raw_session_status="errored_preaggr"), 0)
            )
            all_errored = individual_errors + aggregated_errors

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
        if not (key.raw_session_status is None or key.raw_session_status == "exited"):
            # Ignore tags other than "healthy"
            return []

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


class _LimitState:
    """Keeps track of how to limit each query
    Before the first query, limiting_conditions = None, so the first query
    will apply an ORDER BY ... LIMIT.
    After that, the groups returned by the first query will be added as a
    WHERE clause to any secondary query.
    """

    def __init__(self) -> None:
        self.initialized = False
        self.skip_columns: Set[Column] = set()  # Will not be added to limiting conditions

    def update(self, groupby: Collection[Column], snuba_rows: _SnubaData) -> None:
        if self.initialized:
            return

        # Only "totals" queries may set the limiting conditions:
        assert Column(TS_COL_GROUP) not in groupby

        self._groupby = list(groupby)  # Make sure groupby has a fixed order
        self._groups = [
            {column.name: row[column.name] for column in self._groupby} for row in snuba_rows
        ]

        self.initialized = True

    @property
    def limiting_conditions(self) -> Optional[List[Condition]]:
        if not self.initialized or not self._groups:
            # First query may run without limiting conditions
            # When there are no groups there is nothing to limit
            return None

        group_columns = [col for col in self._groupby if col not in self.skip_columns]

        if not group_columns:
            return []

        # Create conditions from the groups in group by
        group_values = [
            Function("tuple", [row[column.name] for column in group_columns])
            for row in self._groups
        ]

        return [
            # E.g. (release, environment) IN [(1, 2), (3, 4), ...]
            Condition(Function("tuple", group_columns), Op.IN, group_values)
        ] + [
            # These conditions are redundant but might lead to better query performance
            # Eg. [release IN [1, 3]], [environment IN [2, 4]]
            Condition(column, Op.IN, [row[column.name] for row in self._groups])
            for column in group_columns
        ]


def _get_snuba_query(
    org_id: int,
    query: QueryDefinition,
    entity_key: EntityKey,
    metric_id: int,
    columns: List[SelectableExpression],
    series: bool,
    limit_state: _LimitState,
    extra_conditions: List[Condition],
) -> Optional[Query]:
    """Build the snuba query

    Return None if the results from the initial totals query was empty.
    """
    conditions = [
        Condition(Column("org_id"), Op.EQ, org_id),
        Condition(Column("project_id"), Op.IN, query.filter_keys["project_id"]),
        Condition(Column("metric_id"), Op.EQ, metric_id),
        Condition(Column(TS_COL_QUERY), Op.GTE, query.start),
        Condition(Column(TS_COL_QUERY), Op.LT, query.end),
    ]
    conditions += _get_filter_conditions(org_id, query.conditions)
    conditions += extra_conditions

    groupby = {}
    for field in query.raw_groupby:
        if field == "project":
            groupby["project"] = Column("project_id")
            continue

        try:
            groupby[field] = Column(resolve_tag_key(field))
        except MetricIndexNotFound:
            # exclude unresolved keys from groupby
            pass

    full_groupby = list(set(groupby.values()))

    if series:
        full_groupby.append(Column(TS_COL_GROUP))

    query_args = dict(
        dataset=Dataset.Metrics.value,
        match=Entity(entity_key.value),
        select=columns,
        groupby=full_groupby,
        where=conditions,
        granularity=Granularity(query.rollup),
    )

    # In case of group by, either set a limit or use the groups from the
    # first query to limit the results:
    if query.raw_groupby:
        if not limit_state.initialized:
            # Set limit and order by to be consistent with sessions_v2
            max_groups = SNUBA_LIMIT // len(get_timestamps(query))
            query_args["limit"] = Limit(max_groups)
            query_args["orderby"] = [OrderBy(columns[0], Direction.DESC)]
        else:
            if limit_state.limiting_conditions is None:
                # Initial query returned no results, no need to run any more queries
                return None

            query_args["where"] += limit_state.limiting_conditions
            query_args["limit"] = Limit(SNUBA_LIMIT)

    return Query(**query_args)


def _get_snuba_query_data(
    org_id: int,
    query: QueryDefinition,
    entity_key: EntityKey,
    metric_key: MetricKey,
    metric_id: int,
    columns: List[SelectableExpression],
    limit_state: _LimitState,
    extra_conditions: Optional[List[Condition]] = None,
) -> Generator[Tuple[MetricKey, _SnubaData], None, None]:
    """Get data from snuba"""

    for query_type in ("totals", "series"):
        snuba_query = _get_snuba_query(
            org_id,
            query,
            entity_key,
            metric_id,
            columns,
            series=query_type == "series",
            limit_state=limit_state,
            extra_conditions=extra_conditions or [],
        )
        referrer = REFERRERS[metric_key][query_type]
        if snuba_query is None:
            query_data = []
        else:
            query_data = raw_snql_query(snuba_query, referrer=referrer)["data"]
            limit_state.update(snuba_query.groupby, query_data)

        yield (metric_key, query_data)


def _fetch_data(
    org_id: int,
    query: QueryDefinition,
) -> Tuple[_SnubaDataByMetric, Mapping[Tuple[MetricKey, _VirtualColumnName], _OutputField]]:
    """Build & run necessary snuba queries"""

    combined_data: _SnubaDataByMetric = []

    # Find the field that needs a specific column in a specific metric
    metric_to_output_field: MutableMapping[Tuple[MetricKey, _VirtualColumnName], _OutputField] = {}

    # Prevent fields from being fetched multiple times (only used for percentiles)
    columns_fetched: Set[SelectableExpression] = set()

    limit_state = _LimitState()

    for raw_field in query.raw_fields:
        data, field_map = _fetch_data_for_field(
            org_id, query, raw_field, limit_state, columns_fetched
        )
        combined_data.extend(data)
        metric_to_output_field.update(field_map)

    return combined_data, metric_to_output_field


def _fetch_data_for_field(
    org_id: int,
    query: QueryDefinition,
    raw_field: SessionsQueryFunction,
    limit_state: _LimitState,
    columns_fetched: Set[SelectableExpression],  # output param
) -> Tuple[_SnubaDataByMetric, MutableMapping[Tuple[MetricKey, _VirtualColumnName], _OutputField]]:
    tag_key_session_status = resolve_tag_key("session.status")

    data: _SnubaDataByMetric = []

    # Find the field that needs a specific column in a specific metric
    metric_to_output_field: MutableMapping[Tuple[MetricKey, _VirtualColumnName], _OutputField] = {}

    if "count_unique(user)" == raw_field:
        metric_id = indexer.resolve(MetricKey.USER.value)
        if metric_id is not None:
            data.extend(
                _get_snuba_query_data(
                    org_id,
                    query,
                    EntityKey.MetricsSets,
                    MetricKey.USER,
                    metric_id,
                    [Function("uniq", [Column("value")], "value")],
                    limit_state,
                )
            )
            metric_to_output_field[(MetricKey.USER, "value")] = _UserField()

    if raw_field in _DURATION_FIELDS:
        metric_id = indexer.resolve(MetricKey.SESSION_DURATION.value)
        if metric_id is not None:

            def get_virtual_column(field: SessionsQueryFunction) -> _VirtualColumnName:
                return cast(_VirtualColumnName, field[:3])

            group_by_status = "session.status" in query.raw_groupby

            # If we're not grouping by status, we still need to filter down
            # to healthy sessions, because that's what sessions_v2 exposes:
            if group_by_status:
                column_condition = 1
            else:
                healthy = indexer.resolve("exited")
                if healthy is None:
                    # There are no healthy sessions, return
                    return [], {}
                column_condition = Function("equals", (Column(tag_key_session_status), healthy))

            snuba_column = _to_column(raw_field, column_condition)

            if snuba_column not in columns_fetched:
                data.extend(
                    _get_snuba_query_data(
                        org_id,
                        query,
                        EntityKey.MetricsDistributions,
                        MetricKey.SESSION_DURATION,
                        metric_id,
                        [snuba_column],
                        limit_state,
                    )
                )
                columns_fetched.add(snuba_column)

            col = get_virtual_column(raw_field)
            metric_to_output_field[(MetricKey.SESSION_DURATION, col)] = _SessionDurationField(
                raw_field, col, group_by_status
            )

    if "sum(session)" == raw_field:
        metric_id = indexer.resolve(MetricKey.SESSION.value)
        if metric_id is not None:
            if "session.status" in query.raw_groupby:
                # We need session counters grouped by status, as well as the number of errored sessions

                # 1 session counters
                data.extend(
                    _get_snuba_query_data(
                        org_id,
                        query,
                        EntityKey.MetricsCounters,
                        MetricKey.SESSION,
                        metric_id,
                        [Function("sum", [Column("value")], "value")],
                        limit_state,
                    )
                )

                # 2: session.error
                error_metric_id = indexer.resolve(MetricKey.SESSION_ERROR.value)
                if error_metric_id is not None:
                    # Should not limit session.error to session.status=X,
                    # because that tag does not exist for this metric
                    limit_state.skip_columns.add(Column(tag_key_session_status))
                    data.extend(
                        _get_snuba_query_data(
                            org_id,
                            query,
                            EntityKey.MetricsSets,
                            MetricKey.SESSION_ERROR,
                            error_metric_id,
                            [Function("uniq", [Column("value")], "value")],
                            limit_state,
                        )
                    )
                    # Remove skip_column again:
                    limit_state.skip_columns.remove(Column(tag_key_session_status))
            else:
                # Simply count the number of started sessions:
                init = indexer.resolve("init")
                if tag_key_session_status is not None and init is not None:
                    extra_conditions = [Condition(Column(tag_key_session_status), Op.EQ, init)]
                    data.extend(
                        _get_snuba_query_data(
                            org_id,
                            query,
                            EntityKey.MetricsCounters,
                            MetricKey.SESSION,
                            metric_id,
                            [Function("sum", [Column("value")], "value")],
                            limit_state,
                            extra_conditions,
                        )
                    )

            metric_to_output_field[(MetricKey.SESSION, "value")] = _SumSessionField()

    return data, metric_to_output_field


def _flatten_data(org_id: int, data: _SnubaDataByMetric) -> _DataPoints:
    """Unite snuba data from multiple queries into a single key-value map for easier access"""
    data_points = {}

    # It greatly simplifies code if we just assume that these two tags exist:
    # TODO: Can we get away with that assumption?
    tag_key_release = resolve_tag_key("release")
    tag_key_environment = resolve_tag_key("environment")
    tag_key_session_status = resolve_tag_key("session.status")

    for metric_key, metric_data in data:
        for row in metric_data:
            raw_session_status = row.pop(tag_key_session_status, None) or None
            if raw_session_status is not None:
                raw_session_status = reverse_resolve(raw_session_status)
            flat_key = _DataPointKey(
                metric_key=metric_key,
                raw_session_status=raw_session_status,
                release=row.pop(tag_key_release, None),
                environment=row.pop(tag_key_environment, None),
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
    # This is necessary so that we do not mutate the query object shared between different
    # backend runs
    query_clone = deepcopy(query)

    data, metric_to_output_field = _fetch_data(org_id, query_clone)

    data_points = _flatten_data(org_id, data)

    intervals = list(get_intervals(query_clone))
    timestamp_index = {timestamp.isoformat(): index for index, timestamp in enumerate(intervals)}

    def default_for(field: SessionsQueryFunction) -> SessionsQueryValue:
        return 0 if field in ("sum(session)", "count_unique(user)") else None

    GroupKey = Tuple[Tuple[GroupByFieldName, Union[str, int]], ...]

    class Group(TypedDict):
        series: MutableMapping[SessionsQueryFunction, List[SessionsQueryValue]]
        totals: MutableMapping[SessionsQueryFunction, SessionsQueryValue]

    groups: MutableMapping[GroupKey, Group] = defaultdict(
        lambda: {
            "totals": {field: default_for(field) for field in query_clone.raw_fields},
            "series": {
                field: len(intervals) * [default_for(field)] for field in query_clone.raw_fields
            },
        }
    )

    for key in data_points.keys():
        try:
            output_field = metric_to_output_field[key.metric_key, key.column]
        except KeyError:
            continue  # secondary metric, like session.error

        by: MutableMapping[GroupByFieldName, Union[str, int]] = {}
        if key.release is not None:
            # Every session has a release, so this should not throw
            by["release"] = reverse_resolve(key.release)
        if key.environment is not None:
            # To match behavior of the old sessions backend, session data
            # without environment is grouped under the empty string.
            by["environment"] = reverse_resolve_weak(key.environment) or ""
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
        "start": format_datetime(query_clone.start),
        "end": format_datetime(query_clone.end),
        "query": query_clone.query,
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
        return Column(resolve_tag_key(input_.name))

    if isinstance(input_, str):
        # Assuming this is the right-hand side, we need to fetch a tag value.
        # It's OK if the tag value resolves to None, the snuba query will then
        # return no results, as is intended behavior

        return indexer.resolve(input_)

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

    assert isinstance(input_, (tuple, list)), input_
    return [_translate_conditions(org_id, item) for item in input_]
