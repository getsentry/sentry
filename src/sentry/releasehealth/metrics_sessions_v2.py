""" This module offers the same functionality as sessions_v2, but pulls its data
from the `metrics` dataset instead of `sessions`.

Do not call this module directly. Use the `releasehealth` service instead. """
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any, Generator, List, Mapping, MutableMapping, Optional, Sequence, Tuple, Union

from snuba_sdk import Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.legacy import json_to_snql
from typing_extensions import Literal, TypedDict

from sentry.releasehealth.base import (
    GroupByFieldName,
    SelectFieldName,
    SessionsQueryGroup,
    SessionsQueryResult,
    SessionsQueryValue,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.base import UseCase
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import TS_COL_GROUP, TS_COL_QUERY, get_intervals
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.snuba import raw_snql_query


def _resolve(org_id: int, use_case: UseCase, name: str) -> Optional[int]:
    """Wrapper for typing"""
    return indexer.resolve(org_id, use_case, name)  # type: ignore


def _resolve_ensured(org_id: int, use_case: UseCase, name: str) -> int:
    index = _resolve(org_id, use_case, name)
    assert index is not None
    return index


def _reverse_resolve(org_id: int, use_case: UseCase, index: int) -> Optional[str]:
    """Wrapper for typing"""
    return indexer.reverse_resolve(org_id, use_case, index)  # type: ignore


def _reverse_resolve_ensured(org_id: int, use_case: UseCase, index: int) -> str:
    string = _reverse_resolve(org_id, use_case, index)
    assert string is not None
    return string


_SessionStatus = Literal[
    "abnormal",
    "crashed",
    "errored",
    "healthy",
]


@dataclass(frozen=True)
class _StatusValue:
    """A data value associated with a certain session status"""

    session_status: Optional[_SessionStatus]
    value: Union[None, float, int]


@dataclass(frozen=True)
class _FlatKey:
    metric_name: str
    raw_session_status: Optional[str] = None
    release: Optional[int] = None
    environment: Optional[int] = None
    bucketed_time: Optional[datetime] = None
    column: Literal["value", "avg", "max", "p50", "p75", "p90", "p95", "p99"] = "value"
    project_id: Optional[int] = None


_FlatData = MutableMapping[_FlatKey, float]


class _Field:
    name: SelectFieldName = "sum(session)"  # need some default

    def get_values(self, flat_data: _FlatData, key: _FlatKey) -> Sequence[_StatusValue]:
        """List values by session.status"""
        return [_StatusValue(None, flat_data[key])]


class _UserField(_Field):
    name: SelectFieldName = "count_unique(user)"

    def get_values(self, flat_data: _FlatData, key: _FlatKey) -> Sequence[_StatusValue]:

        if key.raw_session_status is None:
            return [_StatusValue(None, int(flat_data[key]))]

        if key.raw_session_status == "init":
            # sessions_v2 always shows all session statuses (even if they have a count of 0),
            # So let's hardcode them here
            started = int(flat_data[key])
            abnormal = int(flat_data.get(replace(key, raw_session_status="abnormal"), 0))
            crashed = int(flat_data.get(replace(key, raw_session_status="crashed"), 0))
            all_errored = int(flat_data.get(replace(key, raw_session_status="crashed"), 0))

            healthy = max(0, started - all_errored)
            errored = max(0, all_errored - abnormal - crashed)

            return [
                _StatusValue("abnormal", abnormal),
                _StatusValue("crashed", crashed),
                _StatusValue("errored", errored),
                _StatusValue("healthy", healthy),
            ]

        return []  # Everything's been handled above


class _SumSessionField(_Field):
    name: SelectFieldName = "sum(session)"

    def get_values(self, flat_data: _FlatData, key: _FlatKey) -> Sequence[_StatusValue]:

        if key.raw_session_status is None:
            return [_StatusValue(None, int(flat_data[key]))]

        if key.raw_session_status == "init":
            # sessions_v2 always shows all session statuses (even if they have a count of 0),
            # So let's hardcode them here
            started = int(flat_data[key])
            abnormal = int(flat_data.get(replace(key, raw_session_status="abnormal"), 0))
            crashed = int(flat_data.get(replace(key, raw_session_status="crashed"), 0))
            errored_key = replace(key, metric_name="session.error", raw_session_status=None)
            all_errored = int(flat_data.get(errored_key, 0))

            healthy = max(0, started - all_errored)
            errored = max(0, all_errored - abnormal - crashed)

            return [
                _StatusValue("abnormal", abnormal),
                _StatusValue("crashed", crashed),
                _StatusValue("errored", errored),
                _StatusValue("healthy", healthy),
            ]

        return []  # Everything's been handled above


class _DistributionField(_Field):
    def __init__(self, name: SelectFieldName) -> None:
        self.name = name
        # TODO: handle group status here

    def get_values(self, flat_data: _FlatData, key: _FlatKey) -> Sequence[_StatusValue]:
        if self.name[:3] == key.column:
            if key.raw_session_status is None:
                # This is weird but it seems to be what sessions_v2 does
                return [_StatusValue("healthy", flat_data[key])]

        return []


_MetricName = str
_SnubaData = Sequence[MutableMapping[str, Any]]
_MetricToFields = Mapping[_MetricName, Sequence[_Field]]
_SnubaDataByMetric = Sequence[Tuple[_MetricName, _SnubaData]]


def _fetch_data(
    org_id: int,
    query: QueryDefinition,
) -> Tuple[_SnubaDataByMetric, _MetricToFields]:

    conditions = [
        Condition(Column("org_id"), Op.EQ, org_id),
        Condition(Column("project_id"), Op.IN, query.filter_keys["project_id"]),
        Condition(Column(TS_COL_QUERY), Op.GTE, query.start),
        Condition(Column(TS_COL_QUERY), Op.LT, query.end),
    ]

    conditions.extend(_get_filter_conditions(org_id, query.conditions))

    # It greatly simplifies code if we just assume that these two tags exist:
    # TODO: Can we get away with that assumption?
    tag_key_session_status = _resolve_ensured(org_id, UseCase.TAG_KEY, "session.status")

    groupby_tags = [field for field in query.raw_groupby if field != "project"]

    tag_keys = {field: _resolve(org_id, UseCase.TAG_KEY, field) for field in groupby_tags}
    groupby = {
        field: Column(f"tags[{tag_id}]")
        for field, tag_id in tag_keys.items()
        if tag_id is not None  # exclude unresolved keys from groupby
    }

    if "project" in query.raw_groupby:
        groupby["project"] = Column("project_id")

    data: List[Tuple[_MetricName, _SnubaData]] = []
    metric_to_fields: MutableMapping[_MetricName, Sequence[_Field]] = {}

    def _query(
        entity: str,
        metric_id: int,
        columns: Sequence[str],
        series: bool,
        extra_conditions: List[Condition],
    ) -> Query:
        full_groupby = list(groupby.values())
        if series:
            full_groupby.append(Column(TS_COL_GROUP))

        return Query(
            dataset=Dataset.Metrics.value,
            match=Entity(entity),
            select=[Column(column) for column in columns],
            groupby=full_groupby,
            where=conditions
            + [Condition(Column("metric_id"), Op.EQ, metric_id)]
            + extra_conditions,
            granularity=Granularity(query.rollup),
        )

    # Referrers must be searchable, so no string interpolation here
    referrers = {
        "user": {
            "series": "releasehealth.metrics.sessions_v2.user.series",
            "totals": "releasehealth.metrics.sessions_v2.user.totals",
        },
        "session.duration": {
            "series": "releasehealth.metrics.sessions_v2.session.duration.series",
            "totals": "releasehealth.metrics.sessions_v2.session.duration.totals",
        },
        "session": {
            "series": "releasehealth.metrics.sessions_v2.session.series",
            "totals": "releasehealth.metrics.sessions_v2.session.totals",
        },
        "session.error": {
            "series": "releasehealth.metrics.sessions_v2.session.error.series",
            "totals": "releasehealth.metrics.sessions_v2.session.error.totals",
        },
    }

    def _query_data(
        entity: str,
        metric_name: str,
        metric_id: int,
        columns: Sequence[str],
        extra_conditions: Optional[List[Condition]] = None,
    ) -> Generator[Tuple[_MetricName, _SnubaData], None, None]:
        if extra_conditions is None:
            extra_conditions = []

        for query_type in ("series", "totals"):
            snuba_query = _query(
                entity,
                metric_id,
                columns,
                series=query_type == "series",
                extra_conditions=extra_conditions,
            )
            referrer = referrers[metric_name][query_type]
            query_data = raw_snql_query(snuba_query, referrer=referrer)["data"]

            yield (metric_name, query_data)

    if "count_unique(user)" in query.raw_fields:
        metric_id = _resolve(org_id, UseCase.METRIC, "user")
        if metric_id is not None:
            data.extend(_query_data("metrics_sets", "user", metric_id, ["value"]))
            metric_to_fields["user"] = [_UserField()]

    duration_fields = [field for field in query.raw_fields if "session.duration" in field]
    if duration_fields:
        metric_id = _resolve(org_id, UseCase.METRIC, "session.duration")
        if metric_id is not None:
            columns = {"percentiles" if field[0] == "p" else field[:3] for field in duration_fields}
            # TODO: What about avg., max.
            data.extend(
                _query_data("metrics_distributions", "session.duration", metric_id, list(columns))
            )
            metric_to_fields["session.duration"] = [
                _DistributionField(field) for field in duration_fields
            ]

    if "sum(session)" in query.raw_fields:
        metric_id = _resolve(org_id, UseCase.METRIC, "session")
        if metric_id is not None:
            if "session.status" in groupby:
                # We need session counters grouped by status, as well as the number of errored sessions

                # 1 session counters
                data.extend(_query_data("metrics_counters", "session", metric_id, ["value"]))

                # 2: session.error
                error_metric_id = _resolve(org_id, UseCase.METRIC, "session.error")
                if error_metric_id is not None:
                    groupby.pop("session.status")
                    data.extend(
                        _query_data("metrics_sets", "session.error", error_metric_id, ["value"])
                    )
            else:
                # Simply count the number of started sessions:
                init = _resolve(org_id, UseCase.TAG_VALUE, "init")
                if tag_key_session_status is not None and init is not None:
                    extra_conditions = [
                        Condition(Column(f"tags[{tag_key_session_status}]"), Op.EQ, init)
                    ]
                    data.extend(
                        _query_data(
                            "metrics_counters", "session", metric_id, ["value"], extra_conditions
                        )
                    )

            metric_to_fields["session"] = [_SumSessionField()]

    return data, metric_to_fields


def _flatten_data(org_id: int, data: _SnubaDataByMetric) -> _FlatData:
    flat_data = {}

    # It greatly simplifies code if we just assume that these two tags exist:
    # TODO: Can we get away with that assumption?
    tag_key_release = _resolve(org_id, UseCase.TAG_KEY, "release")
    assert tag_key_release is not None
    tag_key_environment = _resolve(org_id, UseCase.TAG_KEY, "environment")
    assert tag_key_environment is not None
    tag_key_session_status = _resolve(org_id, UseCase.TAG_KEY, "session.status")
    assert tag_key_session_status is not None

    for metric_name, metric_data in data:
        for row in metric_data:

            raw_session_status = row.pop(f"tags[{tag_key_session_status}]", None)
            if raw_session_status is not None:
                raw_session_status = _reverse_resolve_ensured(
                    org_id, UseCase.TAG_VALUE, raw_session_status
                )
            flat_key = _FlatKey(
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
                    flat_data[percentile_key] = percentiles[i]

            # Remaining data are simple columns:
            for key in list(row.keys()):
                assert key in ("avg", "max", "value")
                flat_data[replace(flat_key, column=key)] = row.pop(key)

            assert row == {}

    return flat_data


def run_sessions_query(
    org_id: int,
    query: QueryDefinition,
    span_op: str,
) -> SessionsQueryResult:

    data, metric_to_fields = _fetch_data(org_id, query)

    flat_data = _flatten_data(org_id, data)

    intervals = list(get_intervals(query))
    timestamp_index = {timestamp.isoformat(): index for index, timestamp in enumerate(intervals)}

    def default_for(field: SelectFieldName) -> SessionsQueryValue:
        return 0 if field in ("sum(session)", "count_unique(user)") else None

    class Group(TypedDict):
        series: MutableMapping[SelectFieldName, List[SessionsQueryValue]]
        totals: MutableMapping[SelectFieldName, SessionsQueryValue]

    groups: MutableMapping[Tuple[Tuple[GroupByFieldName, Union[str, int]]], Group] = defaultdict(
        lambda: {
            "totals": {field: default_for(field) for field in query.raw_fields},
            "series": {field: len(intervals) * [default_for(field)] for field in query.raw_fields},
        }
    )

    for key in flat_data.keys():
        try:
            fields = metric_to_fields[key.metric_name]
        except KeyError:
            continue  # secondary metric, like session.error

        by: MutableMapping[GroupByFieldName, Union[str, int]] = {}
        if key.release is not None:
            # Note: If the tag value reverse-resolves to None here, it's a bug in the tag indexer
            by["release"] = _reverse_resolve_ensured(org_id, UseCase.TAG_VALUE, key.release)
        if key.environment is not None:
            by["environment"] = _reverse_resolve_ensured(org_id, UseCase.TAG_VALUE, key.environment)
        if key.project_id is not None:
            by["project"] = key.project_id

        assert fields

        for field in fields:
            for status_value in field.get_values(flat_data, key):
                if status_value.session_status is not None:
                    by["session.status"] = status_value.session_status

                group = groups[tuple(sorted(by.items()))]

                if key.bucketed_time is None:
                    group["totals"][field.name] = status_value.value
                else:
                    index = timestamp_index[key.bucketed_time]
                    group["series"][field.name][index] = status_value.value

    groups_as_list: List[SessionsQueryGroup] = [
        {
            "by": dict(by),
            **group,
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

    # Translate given conditions to typed query:
    dummy_entity = "metrics_sets"
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
        tag_key = _resolve(org_id, UseCase.TAG_KEY, input_.name)
        assert tag_key is not None

        return Column(f"tags[{tag_key}]")

    if isinstance(input_, str):
        # Assuming this is the right-hand side, we need to fetch a tag value.
        # It's OK if the tag value resolves to None, the snuba query will then
        # return no results, as is intended behavior

        return _resolve(org_id, UseCase.TAG_VALUE, input_)

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
