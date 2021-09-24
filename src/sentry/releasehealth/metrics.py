from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple, Union

import pytz
from snuba_sdk import BooleanCondition, Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity
from snuba_sdk.query import SelectableExpression

from sentry.models.project import Project
from sentry.releasehealth.base import (
    EnvironmentName,
    OrganizationId,
    ProjectId,
    ReleaseHealthBackend,
    ReleaseName,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.base import UseCase
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import TS_COL_QUERY, get_intervals
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.snuba import raw_snql_query


def metric_id(org_id: int, name: str) -> int:
    index = indexer.resolve(org_id, UseCase.TAG_KEY, name)  # type: ignore
    assert index is not None  # TODO: assert too strong?
    return index  # type: ignore


def tag_key(org_id: int, name: str) -> str:
    index = indexer.resolve(org_id, UseCase.TAG_KEY, name)  # type: ignore
    assert index is not None
    return f"tags[{index}]"


def tag_value(org_id: int, name: str) -> int:
    index = indexer.resolve(org_id, UseCase.TAG_VALUE, name)  # type: ignore
    assert index is not None
    return index  # type: ignore


def reverse_tag_value(org_id: int, index: int) -> str:
    str_value = indexer.reverse_resolve(org_id, UseCase.TAG_VALUE, index)  # type: ignore
    assert str_value is not None
    return str_value  # type: ignore


class MetricsReleaseHealthBackend(ReleaseHealthBackend):
    """Gets release health results from the metrics dataset"""

    def get_current_and_previous_crash_free_rates(
        self,
        project_ids: Sequence[int],
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime,
        rollup: int,
        org_id: Optional[int] = None,
    ) -> ReleaseHealthBackend.CurrentAndPreviousCrashFreeRates:
        if org_id is None:
            org_id = self._get_org_id(project_ids)

        projects_crash_free_rate_dict: ReleaseHealthBackend.CurrentAndPreviousCrashFreeRates = {
            prj: {"currentCrashFreeRate": None, "previousCrashFreeRate": None}
            for prj in project_ids
        }

        previous = self._get_crash_free_rate_data(
            org_id,
            project_ids,
            previous_start,
            previous_end,
            rollup,
        )

        for project_id, project_data in previous.items():
            projects_crash_free_rate_dict[project_id][
                "previousCrashFreeRate"
            ] = self._compute_crash_free_rate(project_data)

        current = self._get_crash_free_rate_data(
            org_id,
            project_ids,
            current_start,
            current_end,
            rollup,
        )

        for project_id, project_data in current.items():
            projects_crash_free_rate_dict[project_id][
                "currentCrashFreeRate"
            ] = self._compute_crash_free_rate(project_data)

        return projects_crash_free_rate_dict

    @staticmethod
    def _get_org_id(project_ids: Sequence[int]) -> int:
        projects = Project.objects.get_many_from_cache(project_ids)
        org_ids: Set[int] = {project.organization_id for project in projects}
        if len(org_ids) != 1:
            raise ValueError("Expected projects to be from the same organization")

        return org_ids.pop()

    @staticmethod
    def _get_crash_free_rate_data(
        org_id: int,
        project_ids: Sequence[int],
        start: datetime,
        end: datetime,
        rollup: int,
    ) -> Dict[int, Dict[str, float]]:

        data: Dict[int, Dict[str, float]] = {}

        session_status = tag_key(org_id, "session.status")

        count_query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity("metrics_counters"),
            select=[Column("value")],
            where=[
                Condition(Column("org_id"), Op.EQ, org_id),
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
            ],
            groupby=[
                Column("project_id"),
                Column(session_status),
            ],
            granularity=Granularity(rollup),
        )

        count_data = raw_snql_query(
            count_query, referrer="releasehealth.metrics.get_crash_free_data", use_cache=False
        )["data"]

        for row in count_data:
            project_data = data.setdefault(row["project_id"], {})
            tag_value = reverse_tag_value(org_id, row[session_status])
            project_data[tag_value] = row["value"]

        return data

    @staticmethod
    def _compute_crash_free_rate(data: Dict[str, float]) -> Optional[float]:
        total_session_count = data.get("init", 0)
        crash_count = data.get("crashed", 0)

        if total_session_count == 0:
            return None

        crash_free_rate = 1.0 - (crash_count / total_session_count)

        # If crash count is larger than total session count for some reason
        crash_free_rate = 100 * max(0.0, crash_free_rate)

        return crash_free_rate

    def get_release_adoption(
        self,
        project_releases: Sequence[Tuple[ProjectId, ReleaseName]],
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
        org_id: Optional[OrganizationId] = None,
    ) -> ReleaseHealthBackend.ReleasesAdoption:
        project_ids = list({x[0] for x in project_releases})
        if org_id is None:
            org_id = self._get_org_id(project_ids)

        if now is None:
            now = datetime.now(pytz.utc)

        return self._get_release_adoption_impl(
            now, org_id, project_releases, project_ids, environments
        )

    @staticmethod
    def _get_release_adoption_impl(
        now: datetime,
        org_id: int,
        project_releases: Sequence[Tuple[ProjectId, ReleaseName]],
        project_ids: Sequence[ProjectId],
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleaseHealthBackend.ReleasesAdoption:
        start = now - timedelta(days=1)

        def _get_common_where(total: bool) -> List[Union[BooleanCondition, Condition]]:
            where_common: List[Union[BooleanCondition, Condition]] = [
                Condition(Column("org_id"), Op.EQ, org_id),
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, now),
                Condition(
                    Column(tag_key(org_id, "session.status")), Op.EQ, tag_value(org_id, "init")
                ),
            ]

            if environments is not None:
                environment_tag_values = []

                for environment in environments:
                    value = indexer.resolve(org_id, UseCase.TAG_VALUE, environment)  # type: ignore
                    if value is not None:
                        environment_tag_values.append(value)

                where_common.append(
                    Condition(Column(tag_key(org_id, "environment")), Op.IN, environment_tag_values)
                )

            if not total:
                release_tag_values = []

                for _, release in project_releases:
                    value = indexer.resolve(org_id, UseCase.TAG_VALUE, release)  # type: ignore
                    if value is not None:
                        # We should not append the value if it hasn't been
                        # observed before.
                        release_tag_values.append(value)

                where_common.append(
                    Condition(Column(tag_key(org_id, "release")), Op.IN, release_tag_values)
                )

            return where_common

        def _get_common_groupby(total: bool) -> List[SelectableExpression]:
            if total:
                return [Column("project_id")]
            else:
                return [Column("project_id"), Column(tag_key(org_id, "release"))]

        def _convert_results(data: Any, total: bool) -> Dict[Any, int]:
            if total:
                return {x["project_id"]: x["value"] for x in data}
            else:
                release_tag = tag_key(org_id, "release")
                return {(x["project_id"], x[release_tag]): x["value"] for x in data}

        def _count_sessions(total: bool, referrer: str) -> Dict[Any, int]:
            query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity("metrics_counters"),
                select=[Column("value")],
                where=_get_common_where(total)
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
                ],
                groupby=_get_common_groupby(total),
            )

            return _convert_results(
                raw_snql_query(
                    query,
                    referrer=referrer,
                    use_cache=False,
                )["data"],
                total=total,
            )

        def _count_users(total: bool, referrer: str) -> Dict[Any, int]:
            query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity("metrics_sets"),
                select=[Column("value")],
                where=_get_common_where(total)
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "user")),
                ],
                groupby=_get_common_groupby(total),
            )

            return _convert_results(
                raw_snql_query(
                    query,
                    referrer=referrer,
                    use_cache=False,
                )["data"],
                total=total,
            )

        # XXX(markus): Four queries are quite horrible for this... the old code
        # sufficed with two. From what I understand, ClickHouse would have to
        # gain a function uniqCombined64MergeIf, i.e. a conditional variant of
        # what we already use.
        #
        # Alternatively we may want to use a threadpool here to send the
        # queries in parallel.

        # NOTE: referrers are spelled out as single static string literal so
        # S&S folks can search for it more easily. No string formatting
        # business please!

        # Count of sessions/users for given list of environments and timerange, per-project
        sessions_per_project: Dict[int, int] = _count_sessions(
            total=True, referrer="releasehealth.metrics.get_release_adoption.total_sessions"
        )
        users_per_project: Dict[int, int] = _count_users(
            total=True, referrer="releasehealth.metrics.get_release_adoption.total_users"
        )

        # Count of sessions/users for given list of environments and timerange AND GIVEN RELEASES, per-project
        sessions_per_release: Dict[Tuple[int, int], int] = _count_sessions(
            total=False, referrer="releasehealth.metrics.get_release_adoption.releases_sessions"
        )
        users_per_release: Dict[Tuple[int, int], int] = _count_users(
            total=False, referrer="releasehealth.metrics.get_release_adoption.releases_users"
        )

        rv = {}

        for project_id, release in project_releases:
            release_tag_value = indexer.resolve(org_id, UseCase.TAG_VALUE, release)  # type: ignore
            if release_tag_value is None:
                # Don't emit empty releases -- for exact compatibility with
                # sessions table backend.
                continue

            release_sessions = sessions_per_release.get((project_id, release_tag_value))
            release_users = users_per_release.get((project_id, release_tag_value))

            total_sessions = sessions_per_project.get(project_id)
            total_users = users_per_project.get(project_id)

            adoption: ReleaseHealthBackend.ReleaseAdoption = {
                "adoption": float(release_users) / total_users * 100
                if release_users and total_users
                else None,
                "sessions_adoption": float(release_sessions) / total_sessions * 100
                if release_sessions and total_sessions
                else None,
                "users_24h": release_users,
                "sessions_24h": release_sessions,
                "project_users_24h": total_users,
                "project_sessions_24h": total_sessions,
            }

            rv[project_id, release] = adoption

        return rv

    def run_sessions_query(
        self,
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

        if any("session.duration" in field for field in query.raw_fields):
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

        if "sum(sessions)" in query.fields:
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
                            where=conditions
                            + [Condition(Column("metric_id"), Op.EQ, error_metric_id)],
                        )
                        data["session.error"] = raw_snql_query(
                            snuba_query, referrer="releasehealth.metrics.sessions_v2.session.error"
                        )["data"]

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
                                Condition(
                                    Column(f"tags[{session_status_tag_key}]"), Op.EQ, tag_value
                                ),
                            ],
                        )
                        data["session"] = raw_snql_query(
                            snuba_query, referrer="releasehealth.metrics.sessions_v2.session"
                        )["data"]

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
                "series": {
                    field: len(intervals) * [default_for(field)] for field in query.raw_fields
                },
            }
        )

        metric_to_fields = {"user": "count_unique(user)"}

        for key, value in flat_data.items():
            field = metric_to_fields.get(key.metric_name)
            if field is None:
                continue  # secondary metric, like session.error

            by = {}
            if key.release is not None:
                by["release"] = key.release
            if key.environment is not None:
                by["environment"] = key.environment
            # TODO: handle session status

            group = groups[tuple(sorted(by.items()))]
            if key.timestamp is None:
                # TODO: handle percentiles
                group["totals"][field] = value
            else:
                index = timestamp_index[key.timestamp]
                group["series"][index] = value

        groups = [
            {
                "by": dict(by),
                **group,
            }
            for by, group in groups.items()
        ]

        return {"intervals": [], "groups": groups}
