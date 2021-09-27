""" This module offers the same functionality as sessions_v2, but pulls its data
from the `metrics` dataset instead of `sessions`.

Do not call this module directly. Use the `releasehealth` service instead. """
import enum
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Dict, Mapping, Optional, Sequence, Union

from snuba_sdk import Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.legacy import json_to_snql
from typing_extensions import Literal, TypedDict

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.base import UseCase
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import TS_COL_GROUP, TS_COL_QUERY, get_intervals
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.snuba import raw_snql_query

ProjectId = int
OrganizationId = int
DateString = str


SelectFieldName = Literal[
    "sum(session)",
    "count_unique(user)",
    "avg(session.duration)",
    "p50(session.duration)",
    "p75(session.duration)",
    "p90(session.duration)",
    "p95(session.duration)",
    "p99(session.duration)",
    "max(session.duration)",
]

GroupByFieldName = Literal[
    "project",
    "release",
    "environment",
    "session.status",
]
FilterFieldName = Literal["project", "release", "environment"]


class SessionsQuery(TypedDict):
    org_id: OrganizationId
    project_ids: Sequence[ProjectId]
    select_fields: Sequence[SelectFieldName]
    filter_query: Mapping[FilterFieldName, str]
    start: datetime
    end: datetime
    rollup: int  # seconds


class SessionsQueryGroup(TypedDict):
    by: Mapping[GroupByFieldName, str]
    series: Mapping[SelectFieldName, Sequence[float]]
    totals: Mapping[SelectFieldName, float]


class SessionsQueryResult(TypedDict):
    start: DateString
    end: DateString
    intervals: Sequence[DateString]
    groups: Sequence[SessionsQueryGroup]


class _SelectField(enum.Enum):
    SUM_SESSION = "sum(session)"
    COUNT_UNIQUE_USER = "count_unique(user)"
    AVG_SESSION_DURATION = "avg(session.duration)"
    P50_SESSION_DURATION = "p50(session.duration)"
    P75_SESSION_DURATION = "p75(session.duration)"
    P90_SESSION_DURATION = "p90(session.duration)"
    P95_SESSION_DURATION = "p95(session.duration)"
    P99_SESSION_DURATION = "p99(session.duration)"
    MAX_SESSION_DURATION = "max(session.duration)"


# class _GroupByField(enum.Enum):
#     PROJECT = "project"
#     RELEASE = "release"
#     ENVIRONMENT = "environment"
#     SESSION_STATUS = "session.status"


# ]
# FilterField = Literal["project", "release", "environment"]


@dataclass(frozen=True)
class _FlatKey:
    metric_name: str
    raw_session_status: Optional[str] = None
    release: Optional[str] = None
    environment: Optional[str] = None
    bucketed_time: Optional[datetime] = None
    column: Literal["value", "avg", "max", "p50", "p75", "p90", "p95", "p99"] = "value"


def run_sessions_query(
    org_id: int,
    query: QueryDefinition,
    span_op: str,
) -> SessionsQueryResult:
    conditions = [
        Condition(Column("org_id"), Op.EQ, org_id),
        Condition(Column("project_id"), Op.IN, query.filter_keys["project_id"]),
        Condition(Column(TS_COL_QUERY), Op.GTE, query.start),
        Condition(Column(TS_COL_QUERY), Op.LT, query.end),
    ]

    conditions.extend(_get_filter_conditions(org_id, query.conditions))

    # It greatly simplifies code if we just assume that these two tags exist:
    # TODO: Can we get away with that assumption?
    tag_key_release = indexer.resolve(org_id, UseCase.TAG_KEY, "release")
    assert tag_key_release is not None
    tag_key_environment = indexer.resolve(org_id, UseCase.TAG_KEY, "environment")
    assert tag_key_environment is not None

    tag_keys = {
        field: indexer.resolve(org_id, UseCase.TAG_KEY, field) for field in query.raw_groupby
    }
    groupby = {
        field: Column(f"tags[{tag_id}]")
        for field, tag_id in tag_keys.items()
        if tag_id is not None  # exclude unresolved keys from groupby
    }

    data = []

    session_status_tag_key = indexer.resolve(org_id, UseCase.TAG_KEY, "session.status")

    metric_to_fields = {}

    def _query(
        entity: str,
        metric_id: int,
        columns: Sequence[str],
        series: bool,
        extra_conditions: Sequence[Condition],
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
        extra_conditions: Optional[Sequence[Condition]] = None,
    ):
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
        metric_id = indexer.resolve(org_id, UseCase.METRIC, "user")
        if metric_id is not None:
            data.extend(_query_data("metrics_sets", "user", metric_id, ["value"]))
            metric_to_fields["user"] = [_UserField()]

    duration_fields = [field for field in query.raw_fields if "session.duration" in field]
    if duration_fields:
        metric_id = indexer.resolve(org_id, UseCase.METRIC, "session.duration")
        if metric_id is not None:
            columns = ["percentiles" if field[0] == "p" else field[:3] for field in duration_fields]
            # TODO: What about avg., max.
            data.extend(
                _query_data("metrics_distributions", "session.duration", metric_id, columns)
            )
            metric_to_fields["session.duration"] = [
                _DistributionField(field) for field in duration_fields
            ]

    if "sum(session)" in query.raw_fields:
        metric_id = indexer.resolve(org_id, UseCase.METRIC, "session")
        if metric_id is not None:
            if "session.status" in groupby:
                # We need session counters grouped by status, as well as the number of errored sessions

                # 1 session counters
                data.extend(_query_data("metrics_counters", "session", metric_id, ["value"]))

                # 2: session.error
                error_metric_id = indexer.resolve(org_id, UseCase.METRIC, "session.error")
                if error_metric_id is not None:
                    groupby.pop("session.status")
                    data.extend(
                        _query_data("metrics_sets", "session.error", error_metric_id, ["value"])
                    )

                metric_to_fields["session"] = [_SumSessionByStatusField()]

            else:
                # Simply count the number of started sessions:
                init = indexer.resolve(org_id, UseCase.TAG_VALUE, "init")
                if session_status_tag_key is not None and init is not None:
                    extra_conditions = [
                        Condition(Column(f"tags[{session_status_tag_key}]"), Op.EQ, init)
                    ]
                    data.extend(
                        _query_data(
                            "metrics_counters", "session", metric_id, ["value"], extra_conditions
                        )
                    )

                metric_to_fields["session"] = [_SumSessionField()]

    flat_data: Dict[_FlatKey, Union[None, float, Sequence[float]]] = {}
    for metric_name, metric_data in data:
        for row in metric_data:

            raw_session_status = row.pop(f"tags[{session_status_tag_key}]", None)
            if raw_session_status is not None:
                raw_session_status = indexer.reverse_resolve(
                    org_id, UseCase.TAG_VALUE, raw_session_status
                )
                assert raw_session_status is not None
            flat_key = _FlatKey(
                metric_name=metric_name,
                raw_session_status=raw_session_status,
                release=row.pop(f"tags[{tag_key_release}]", None),
                environment=row.pop(f"tags[{tag_key_environment}]", None),
                bucketed_time=row.pop("bucketed_time", None),
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

    intervals = list(get_intervals(query))
    timestamp_index = {timestamp.isoformat(): index for index, timestamp in enumerate(intervals)}

    def default_for(field):
        return 0 if field in ("sum(session)", "count_unique(user)") else None

    groups = defaultdict(
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

        by = {}
        if key.release is not None:
            # Note: If the tag value reverse-resolves to None here, it's a bug in the tag indexer
            release = by["release"] = indexer.reverse_resolve(
                org_id, UseCase.TAG_VALUE, key.release
            )
            assert release is not None
        if key.environment is not None:
            environment = by["environment"] = indexer.reverse_resolve(
                org_id, UseCase.TAG_VALUE, key.environment
            )
            assert environment is not None

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

    groups = [
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
        "groups": groups,
    }


def _get_filter_conditions(org_id, conditions):

    # Translate given conditions to typed query:
    dummy_entity = "metrics_sets"
    filter_conditions = json_to_snql(
        {"selected_columns": ["value"], "conditions": conditions}, entity=dummy_entity
    ).where
    return _translate_conditions(org_id, filter_conditions)


def _translate_conditions(org_id, input_):
    if isinstance(input_, Column):
        # The only filterable tag keys are release and environment.
        assert input_.name in ("release", "environment")
        # It greatly simplifies code if we just assume that they exist.
        # Alternative would be:
        #   * if tag key or value does not exist in AND-clause, return no data
        #   * if tag key or value does not exist in OR-clause, remove condition
        tag_key = indexer.resolve(org_id, UseCase.TAG_KEY, input_.name)
        assert tag_key is not None

        return Column(f"tags[{tag_key}]")

    if isinstance(input_, str):
        # Assuming this is the right-hand side, we need to fetch a tag value.
        # It's OK if the tag value resolves to None, the snuba query will then
        # return no results, as is intended behavior

        return indexer.resolve(org_id, UseCase.TAG_VALUE, input_)

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


SessionStatus = Literal[
    "abnormal",
    "crashed",
    "errored",
    "healthy",
]


@dataclass(frozen=True)
class StatusValue:
    """A data value associated with a certain session status"""

    session_status: Optional[SessionStatus]
    value: Union[None, float, int]


class _Field:
    def get_values(self, flat_data, key) -> Sequence[StatusValue]:
        """List values by session.status"""
        return [StatusValue(None, flat_data[key])]


class _UserField(_Field):

    name = "count_unique(user)"

    def get_session_status(self, raw_session_status: Optional[str]):
        # Not every init session is healthy, but that is taken care of in get_value
        return "healthy" if raw_session_status == "init" else raw_session_status

    def get_values(self, flat_data, key) -> Sequence[StatusValue]:

        if key.raw_session_status == "init":
            # Transform init to healthy:
            errored_key = replace(key, raw_session_status="errored")
            started = int(flat_data[key])
            errored = int(flat_data[errored_key])

            return [
                StatusValue("healthy", started - errored),
                StatusValue("errored", errored),  # FIXME: subtract fatals
            ]

        return [StatusValue(key.raw_session_status, int(flat_data[key]))]


class _SumSessionField(_Field):
    name = "sum(session)"


class _SumSessionByStatusField(_SumSessionField):
    """Specialized version for when grouped by session.status"""

    def get_session_status(self, raw_session_status: Optional[str]):
        # Not every init session is healthy, but that is taken care of in get_value
        return "healthy" if raw_session_status == "init" else raw_session_status

    def get_values(self, flat_data, key) -> Sequence[StatusValue]:
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
                StatusValue("abnormal", abnormal),
                StatusValue("crashed", crashed),
                StatusValue("errored", errored),
                StatusValue("healthy", healthy),
            ]

        return []


class _DistributionField(_Field):
    def __init__(self, name: str) -> None:
        self.name = name
