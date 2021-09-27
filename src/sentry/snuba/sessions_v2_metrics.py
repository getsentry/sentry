""" This module offers the same functionality as sessions_v2, but pulls its data
from the `metrics` dataset instead of `sessions`.

Do not call this module directly. Use the `releasehealth` service instead. """
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional, Sequence, Union

from snuba_sdk import Column, Condition, Entity, Op, Query

from sentry.releasehealth.base import ReleaseHealthBackend
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.base import UseCase
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import TS_COL_QUERY, get_intervals
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.snuba import raw_snql_query


def run_sessions_query(
    org_id: int,
    query: QueryDefinition,
    span_op: str,
) -> ReleaseHealthBackend.SessionsQueryResult:
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

    data = {}

    session_status_tag_key = indexer.resolve(org_id, UseCase.TAG_KEY, "session.status")

    metric_to_fields = {}

    if "count_unique(user)" in query.raw_fields:
        metric_id = indexer.resolve(org_id, UseCase.METRIC, "user")
        if metric_id is not None:
            snuba_query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity("metrics_sets"),
                select=[Column("value")],
                groupby=list(groupby.values()),
                where=conditions + [Condition(Column("metric_id"), Op.EQ, metric_id)],
            )
            data["user"] = raw_snql_query(
                snuba_query, referrer="releasehealth.metrics.sessions_v2.user"
            )["data"]
            metric_to_fields["user"] = [_UserField("count_unique(user")]

    duration_fields = [field for field in query.raw_fields if "session.duration" in field]
    if duration_fields:
        metric_id = indexer.resolve(org_id, UseCase.METRIC, "session.duration")
        if metric_id is not None:
            snuba_query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity("metrics_distrubutions"),
                select=[Column("percentiles")],
                groupby=list(groupby.values()),
                where=conditions + [Condition(Column("metric_id"), Op.EQ, metric_id)],
            )
            data["session.duration"] = raw_snql_query(
                snuba_query, referrer="releasehealth.metrics.sessions_v2.session.duration"
            )["data"]
            metric_to_fields["session.duration"] = [
                _DistributionField(field) for field in duration_fields
            ]

    if "sum(session)" in query.fields:
        metric_id = indexer.resolve(org_id, UseCase.METRIC, "session")
        if metric_id is not None:
            if "session.status" in groupby:
                # We need session counters grouped by status, as well as the number of errored sessions

                # 1 session counters
                snuba_query = Query(
                    dataset=Dataset.Metrics.value,
                    match=Entity("metrics_counters"),
                    select=[Column("value")],
                    groupby=list(groupby.values()),
                    where=conditions
                    + [
                        Condition(Column("metric_id"), Op.EQ, metric_id),
                    ],
                )
                data["session"] = raw_snql_query(
                    snuba_query, referrer="releasehealth.metrics.sessions_v2.session_groupby"
                )["data"]

                # 2: session.error
                error_metric_id = indexer.resolve(org_id, UseCase.METRIC, "session.error")
                if error_metric_id is not None:
                    groupby.pop("session.status")
                    snuba_query = Query(
                        dataset=Dataset.Metrics.value,
                        match=Entity("metrics_sets"),
                        select=[Column("value")],
                        groupby=list(groupby.values()),
                        where=conditions + [Condition(Column("metric_id"), Op.EQ, error_metric_id)],
                    )
                    data["session.error"] = raw_snql_query(
                        snuba_query, referrer="releasehealth.metrics.sessions_v2.session.error"
                    )["data"]

                metric_to_fields["session"] = [_GroupedSessionField("sum(session)")]

            else:
                # Simply count the number of started sessions:
                tag_value = indexer.resolve(org_id, UseCase.TAG_VALUE, "init")
                if session_status_tag_key is not None and tag_value is not None:
                    snuba_query = Query(
                        dataset=Dataset.Metrics.value,
                        match=Entity("metrics_counters"),
                        select=[Column("value")],
                        groupby=list(groupby.values()),
                        where=conditions
                        + [
                            Condition(Column("metric_id"), Op.EQ, metric_id),
                            Condition(Column(f"tags[{session_status_tag_key}]"), Op.EQ, tag_value),
                        ],
                    )
                    data["session"] = raw_snql_query(
                        snuba_query, referrer="releasehealth.metrics.sessions_v2.session"
                    )["data"]

                metric_to_fields["session"] = [_UserField("sum(session)")]

    @dataclass(frozen=True)
    class FlatKey:
        metric_name: str
        raw_session_status: Optional[str] = None
        release: Optional[str] = None
        environment: Optional[str] = None
        timestamp: Optional[datetime] = None

    flat_data: Dict[FlatKey, Union[None, float, Sequence[float]]] = {}
    for metric_name, metric_data in data.items():
        for row in metric_data:
            value_key = "percentiles" if metric_name == "session.duration" else "value"
            value = row.pop(value_key)
            raw_session_status = row.pop(f"tags[{session_status_tag_key}]", None)
            flat_key = FlatKey(
                metric_name=metric_name, raw_session_status=raw_session_status, **row
            )
            flat_data[flat_key] = value

    intervals = list(get_intervals(query))
    timestamp_index = {timestamp: index for index, timestamp in enumerate(intervals)}

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
            if key.timestamp is None:
                # TODO: handle percentiles
                group["totals"][field.name] = value
            else:
                index = timestamp_index[key.timestamp]
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
    def __init__(self, name: str) -> None:
        self.name = name

    def get_session_status(self, raw_session_status: Optional[str]) -> Optional[str]:
        return None

    def get_value(self, flat_data, key):
        return flat_data[key]


class _UserField(_Field):
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


class _GroupedSessionField(_Field):
    def get_value(self, flat_data, key):
        # This assumes the correct queries were made
        error_key = key.copy()
        error_key.metric_name = "session.error"
        # TODO: magic
        return int(flat_data[key])


class _DistributionField(_Field):
    def get_value(self, flat_data, key):
        return -1  # FIXME
