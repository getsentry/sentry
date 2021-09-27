""" This module offers the same functionality as sessions_v2, but pulls its data
from the `metrics` dataset instead of `sessions`.

Do not call this module directly. Use the `releasehealth` service instead. """
import enum
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Mapping, Optional, Sequence, Union

from snuba_sdk import Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity
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


def run_sessions_query(
    org_id: int,
    query: QueryDefinition,
    span_op: str,
) -> SessionsQueryResult:
    conditions = [
        Condition(Column("org_id"), Op.EQ, org_id),
        Condition(Column("project_id"), Op.IN, query.filter_keys["project_id"]),
        # Condition(
        #     Column("metric_id"),
        #     Op.IN,
        #     [
        #         indexer.resolve(self._project.id, UseCase.METRIC, name)
        #         for _, name in query_definition.fields.values()
        #     ],
        # ),
        Condition(Column(TS_COL_QUERY), Op.GTE, query.start),
        Condition(Column(TS_COL_QUERY), Op.LT, query.end),
    ]
    # FIXME: add filter conditions

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

    def _query(entity: str, metric_id: int, column: str, series: bool) -> Query:
        full_groupby = list(groupby.values())
        if series:
            full_groupby.append(Column(TS_COL_GROUP))

        return Query(
            dataset=Dataset.Metrics.value,
            match=Entity(entity),
            select=[Column(column)],
            groupby=full_groupby,
            where=conditions + [Condition(Column("metric_id"), Op.EQ, metric_id)],
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
            "totals": "releasehealth.metrics.sessions_v2.totals",
        },
    }

    def _query_data(entity: str, metric_name: str, metric_id: int, column: str):
        for query_type in ("series", "totals"):
            snuba_query = _query(entity, metric_id, column, series=query_type == "series")
            referrer = referrers[metric_name][query_type]
            query_data = raw_snql_query(snuba_query, referrer=referrer)["data"]
            yield (metric_name, query_data)

    if "count_unique(user)" in query.raw_fields:
        metric_id = indexer.resolve(org_id, UseCase.METRIC, "user")
        if metric_id is not None:
            data.extend(_query_data("metrics_sets", "user", metric_id, "value"))
            metric_to_fields["user"] = [_UserField()]

    duration_fields = [field for field in query.raw_fields if "session.duration" in field]
    if duration_fields:
        metric_id = indexer.resolve(org_id, UseCase.METRIC, "session.duration")
        if metric_id is not None:
            # TODO: What about avg., max.
            data.extend(
                _query_data("metrics_distributions", "session.duration", metric_id, "percentiles")
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
                data.extend(_query_data("metrics_counters", "session", metric_id, "value"))

                # 2: session.error
                error_metric_id = indexer.resolve(org_id, UseCase.METRIC, "session.error")
                if error_metric_id is not None:
                    groupby.pop("session.status")
                    data.extend(_query_data("metrics_sets", "session", error_metric_id, "value"))

                metric_to_fields["session"] = [_SumSessionByStatusField()]

            else:
                # Simply count the number of started sessions:
                tag_value = indexer.resolve(org_id, UseCase.TAG_VALUE, "init")
                if session_status_tag_key is not None and tag_value is not None:
                    data.extend(_query_data("metrics_counters", "session", metric_id, "value"))

                    # FIXME: require group by

                metric_to_fields["session"] = [_SumSessionField()]

    flat_data: Dict[_FlatKey, Union[None, float, Sequence[float]]] = {}
    for metric_name, metric_data in data:
        for row in metric_data:
            value_key = "percentiles" if metric_name == "session.duration" else "value"
            value = row.pop(value_key)
            raw_session_status = row.pop(f"tags[{session_status_tag_key}]", None)
            flat_key = _FlatKey(
                metric_name=metric_name, raw_session_status=raw_session_status, **row
            )
            flat_data[flat_key] = value

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
            by["release"] = key.release
        if key.environment is not None:
            by["environment"] = key.environment

        group = groups[tuple(sorted(by.items()))]
        assert fields
        session_status = fields[0].get_session_status(key.raw_session_status)
        if session_status is not None:
            by["session.status"] = session_status

        for field in fields:
            value = field.get_value(flat_data, key)
            if key.bucketed_time is None:
                # TODO: handle percentiles
                group["totals"][field.name] = value
            else:
                index = timestamp_index[key.bucketed_time]
                group["series"][field.name][index] = value

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


class _Field:
    def get_session_status(self, raw_session_status: Optional[str]) -> Optional[str]:
        return None

    def get_value(self, flat_data, key):
        return flat_data[key]


class _UserField(_Field):

    name = "count_unique(user)"

    def get_session_status(self, raw_session_status: Optional[str]):
        # Not every init session is healthy, but that is taken care of in get_value
        return "healthy" if raw_session_status == "init" else raw_session_status

    def get_value(self, flat_data, key):

        if key.raw_session_status == "init":
            # Transform init to healthy:
            errored_key = key.replace(raw_session_status="errored")
            started = int(flat_data[key])
            errored = int(flat_data[errored_key])

            return started - errored

        return int(flat_data[key])


class _SumSessionField(_Field):
    name = "sum(session)"


class _SumSessionByStatusField(_SumSessionField):
    """Specialized version for when grouped by session.status"""

    def get_session_status(self, raw_session_status: Optional[str]):
        # Not every init session is healthy, but that is taken care of in get_value
        return "healthy" if raw_session_status == "init" else raw_session_status

    def get_value(self, flat_data, key):
        # This assumes the correct queries were made

        #        error_key = key.replace(metric_name="session.error")
        # TODO: magic
        return int(flat_data[key])


class _DistributionField(_Field):
    def __init__(self, name: str) -> None:
        self.name = name

    def get_value(self, flat_data, key):
        return -1  # FIXME


def _get_query(for_series: bool):
    return
