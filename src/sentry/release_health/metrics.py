from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Set, Tuple, Union

import pytz
from snuba_sdk import BooleanCondition, Column, Condition, Entity, Op, Query
from snuba_sdk.expressions import Granularity
from snuba_sdk.query import SelectableExpression

from sentry import release_health
from sentry.models.project import Project
from sentry.release_health.base import (
    CurrentAndPreviousCrashFreeRates,
    EnvironmentName,
    OrganizationId,
    OverviewStat,
    ProjectId,
    ProjectOrRelease,
    ProjectRelease,
    ReleaseAdoption,
    ReleaseHealthBackend,
    ReleaseName,
    ReleasesAdoption,
    StatsPeriod,
)
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset
from sentry.snuba.sessions import _make_stats, get_rollup_starts_and_buckets, parse_snuba_datetime
from sentry.utils.snuba import raw_snql_query


def metric_id(org_id: int, name: str) -> int:
    index = indexer.resolve(org_id, name)  # type: ignore
    assert index is not None  # TODO: assert too strong?
    return index  # type: ignore


def tag_key(org_id: int, name: str) -> str:
    index = indexer.resolve(org_id, name)  # type: ignore
    assert index is not None
    return f"tags[{index}]"


def tag_value(org_id: int, name: str) -> int:
    index = indexer.resolve(org_id, name)  # type: ignore
    assert index is not None
    return index  # type: ignore


def try_get_tag_value(org_id: int, name: str) -> Optional[int]:
    return indexer.resolve(org_id, name)  # type: ignore


def reverse_tag_value(org_id: int, index: int) -> str:
    str_value = indexer.reverse_resolve(org_id, index)  # type: ignore
    assert str_value is not None
    return str_value  # type: ignore


def get_tag_values_list(org_id: int, values: Sequence[str]) -> Sequence[int]:
    return [x for x in [try_get_tag_value(org_id, x) for x in values] if x is not None]


def filter_projects_by_project_release(org_id: int, project_releases: Sequence[ProjectRelease]):
    return Condition(Column("project_id"), Op.IN, list(x for x, _ in project_releases))


def filter_releases_by_project_release(org_id: int, project_releases: Sequence[ProjectRelease]):
    return Condition(
        Column(tag_key(org_id, "release")),
        Op.IN,
        get_tag_values_list(org_id, [x for _, x in project_releases]),
    )


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
    ) -> CurrentAndPreviousCrashFreeRates:
        if org_id is None:
            org_id = self._get_org_id(project_ids)

        projects_crash_free_rate_dict: CurrentAndPreviousCrashFreeRates = {
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
            count_query, referrer="release_health.metrics.get_crash_free_data", use_cache=False
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
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
        org_id: Optional[OrganizationId] = None,
    ) -> ReleasesAdoption:
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
        project_releases: Sequence[ProjectRelease],
        project_ids: Sequence[ProjectId],
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleasesAdoption:
        start = now - timedelta(days=1)

        def _get_common_where(total: bool) -> List[Union[BooleanCondition, Condition]]:
            where_common: List[Union[BooleanCondition, Condition]] = [
                Condition(Column("org_id"), Op.EQ, org_id),
                filter_projects_by_project_release(org_id, project_releases),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, now),
                Condition(
                    Column(tag_key(org_id, "session.status")), Op.EQ, tag_value(org_id, "init")
                ),
            ]

            if environments is not None:
                where_common.append(
                    Condition(
                        Column(tag_key(org_id, "environment")),
                        Op.IN,
                        get_tag_values_list(org_id, environments),
                    )
                )

            if not total:
                where_common.append(filter_releases_by_project_release(org_id, project_releases))

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
            total=True, referrer="release_health.metrics.get_release_adoption.total_sessions"
        )
        users_per_project: Dict[int, int] = _count_users(
            total=True, referrer="release_health.metrics.get_release_adoption.total_users"
        )

        # Count of sessions/users for given list of environments and timerange AND GIVEN RELEASES, per-project
        sessions_per_release: Dict[Tuple[int, int], int] = _count_sessions(
            total=False, referrer="release_health.metrics.get_release_adoption.releases_sessions"
        )
        users_per_release: Dict[Tuple[int, int], int] = _count_users(
            total=False, referrer="release_health.metrics.get_release_adoption.releases_users"
        )

        rv = {}

        for project_id, release in project_releases:
            release_tag_value = indexer.resolve(org_id, release)  # type: ignore
            if release_tag_value is None:
                # Don't emit empty releases -- for exact compatibility with
                # sessions table backend.
                continue

            release_sessions = sessions_per_release.get((project_id, release_tag_value))
            release_users = users_per_release.get((project_id, release_tag_value))

            total_sessions = sessions_per_project.get(project_id)
            total_users = users_per_project.get(project_id)

            adoption: ReleaseAdoption = {
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

    def check_has_health_data(
        self, projects_list: Sequence[ProjectOrRelease]
    ) -> Set[ProjectOrRelease]:
        now = datetime.now(pytz.utc)
        start = now - timedelta(days=3)

        projects_list = list(projects_list)

        if len(projects_list) == 0:
            return set()

        includes_releases = isinstance(projects_list[0], tuple)

        if includes_releases:
            project_ids: List[ProjectId] = [x[0] for x in projects_list]  # type: ignore
        else:
            project_ids = projects_list  # type: ignore

        org_id = self._get_org_id(project_ids)

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, now),
        ]

        if includes_releases:
            releases = [x[1] for x in projects_list]  # type: ignore
            release_column_name = tag_key(org_id, "release")
            where_clause.append(
                Condition(Column(release_column_name), Op.IN, get_tag_values_list(org_id, releases))
            )
            column_names = ["project_id", release_column_name]

        else:
            column_names = ["project_id"]

        def extract_row_info_func(
            include_releases: bool,
        ) -> Callable[[Mapping[str, Union[int, str]]], ProjectOrRelease]:
            def f(row: Mapping[str, Union[int, str]]) -> ProjectOrRelease:
                if include_releases:
                    return row["project_id"], reverse_tag_value(org_id, row.get(release_column_name))  # type: ignore
                else:
                    return row["project_id"]  # type: ignore

            return f

        extract_row_info = extract_row_info_func(includes_releases)

        query_cols = [Column(column_name) for column_name in column_names]
        group_by_clause = query_cols

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity("metrics_counters"),
            select=query_cols,
            where=where_clause,
            groupby=group_by_clause,
        )

        result = raw_snql_query(
            query, referrer="release_health.metrics.check_has_health_data", use_cache=False
        )

        return {extract_row_info(row) for row in result["data"]}

    def check_releases_have_health_data(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        release_versions: Sequence[ReleaseName],
        start: datetime,
        end: datetime,
    ) -> Set[ReleaseName]:

        release_column_name = tag_key(organization_id, "release")
        releases_ids = get_tag_values_list(organization_id, release_versions)
        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity("metrics_counters"),
            select=[Column(release_column_name)],
            where=[
                Condition(Column("org_id"), Op.EQ, organization_id),
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("metric_id"), Op.EQ, metric_id(organization_id, "session")),
                Condition(Column(release_column_name), Op.IN, releases_ids),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
            ],
            groupby=[Column(release_column_name)],
        )

        result = raw_snql_query(
            query,
            referrer="release_health.metrics.check_releases_have_health_data",
            use_cache=False,
        )

        def extract_row_info(row: Mapping[str, Union[OrganizationId, str]]) -> ReleaseName:
            return reverse_tag_value(organization_id, row.get(release_column_name))  # type: ignore

        return {extract_row_info(row) for row in result["data"]}

    @staticmethod
    def _get_session_duration_data_for_overview(
        where: List[Union[BooleanCondition, Condition]], org_id: int
    ) -> Mapping[Tuple[int, str], Any]:
        # Percentiles of session duration
        rv_durations: Mapping[Tuple[int, str], Any] = {}

        release_column_name = tag_key(org_id, "release")
        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
        ]

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity("metrics_distributions"),
                select=aggregates + [Column("percentiles")],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session.duration")),
                ],
                groupby=aggregates,
            ),
            referrer="release_health.metrics.get_session_duration_data_for_overview",
        )["data"]:
            # See https://github.com/getsentry/snuba/blob/8680523617e06979427bfa18c6b4b4e8bf86130f/snuba/datasets/entities/metrics.py#L184 for quantiles
            key = row["project_id"], reverse_tag_value(org_id, row[release_column_name])
            rv_durations[key] = {
                "duration_p50": row["percentiles"][0],
                "duration_p90": row["percentiles"][2],
            }

        return rv_durations

    @staticmethod
    def _get_errored_sessions_for_overview(
        where: List[Union[BooleanCondition, Condition]], org_id: int
    ) -> Mapping[Tuple[int, str], int]:
        # Count of errored sessions, incl fatal (abnormal, crashed) sessions
        rv_errored_sessions: Mapping[Tuple[int, str], int] = {}

        release_column_name = tag_key(org_id, "release")
        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
        ]

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity("metrics_sets"),
                select=aggregates + [Column("value")],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session.error")),
                ],
                groupby=aggregates,
            ),
            referrer="release_health.metrics.get_errored_sessions_for_overview",
        )["data"]:
            key = row["project_id"], reverse_tag_value(org_id, row[release_column_name])
            rv_errored_sessions[key] = row["value"]

        return rv_errored_sessions

    @staticmethod
    def _get_abnormal_and_crashed_sessions_for_overview(
        where: List[Union[BooleanCondition, Condition]], org_id: int
    ) -> Mapping[Tuple[int, str, str], int]:
        release_column_name = tag_key(org_id, "release")
        session_status_column_name = tag_key(org_id, "session.status")

        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
            Column(session_status_column_name),
        ]

        # Count of init, abnormal and crashed sessions, each
        rv_sessions: Mapping[Tuple[int, str, str], int] = {}

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity("metrics_counters"),
                select=aggregates + [Column("value")],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
                    Condition(
                        Column(session_status_column_name),
                        Op.IN,
                        get_tag_values_list(org_id, ["abnormal", "crashed", "init"]),
                    ),
                ],
                groupby=aggregates,
            ),
            referrer="release_health.metrics.get_abnormal_and_crashed_sessions_for_overview",
        )["data"]:
            key = (
                row["project_id"],
                reverse_tag_value(org_id, row[release_column_name]),
                reverse_tag_value(org_id, row[session_status_column_name]),
            )
            rv_sessions[key] = row["value"]

        return rv_sessions

    @staticmethod
    def _get_users_and_crashed_users_for_overview(
        where: List[Union[BooleanCondition, Condition]], org_id: int
    ) -> Mapping[Tuple[int, str, str], int]:
        release_column_name = tag_key(org_id, "release")
        session_status_column_name = tag_key(org_id, "session.status")

        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
            Column(session_status_column_name),
        ]

        # Count of users and crashed users
        rv_users: Mapping[Tuple[int, str, str], int] = {}

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity("metrics_sets"),
                select=aggregates + [Column("value")],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "user")),
                    Condition(
                        Column(session_status_column_name),
                        Op.IN,
                        get_tag_values_list(org_id, ["crashed", "init"]),
                    ),
                ],
                groupby=aggregates,
            ),
            referrer="release_health.metrics.get_users_and_crashed_users_for_overview",
        )["data"]:
            key = (
                row["project_id"],
                reverse_tag_value(org_id, row[release_column_name]),
                reverse_tag_value(org_id, row[session_status_column_name]),
            )
            rv_users[key] = row["value"]

        return rv_users

    @staticmethod
    def _get_health_stats_for_overview(
        where: List[Union[BooleanCondition, Condition]],
        org_id: int,
        health_stats_period: StatsPeriod,
        stat: OverviewStat,
        now: datetime,
    ):
        release_column_name = tag_key(org_id, "release")
        session_status_column_name = tag_key(org_id, "session.status")
        session_init_tag_value = tag_value(org_id, "init")

        stats_rollup, stats_start, stats_buckets = get_rollup_starts_and_buckets(
            health_stats_period
        )

        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
            Column("bucketed_time"),
        ]

        rv = defaultdict(lambda: _make_stats(stats_start, stats_rollup, stats_buckets))

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity("metrics_counters"),
                select=aggregates + [Column("value")],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
                    Condition(Column("timestamp"), Op.GTE, stats_start),
                    Condition(Column("timestamp"), Op.LT, now),
                    Condition(
                        Column(session_status_column_name),
                        Op.EQ,
                        session_init_tag_value,
                    ),
                ],
                granularity=Granularity(stats_rollup),  # type: ignore
                groupby=aggregates,
            ),
            referrer="release_health.metrics.get_health_stats_for_overview",
        )["data"]:
            time_bucket = int(
                (parse_snuba_datetime(row["bucketed_time"]) - stats_start).total_seconds()
                / stats_rollup
            )
            key = row["project_id"], reverse_tag_value(org_id, row[release_column_name])
            timeseries = rv[key]
            assert stat == "sessions"  # TODO
            if time_bucket < len(timeseries):
                timeseries[time_bucket][1] = row["value"]

        return rv

    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        summary_stats_period: Optional[StatsPeriod] = None,
        health_stats_period: Optional[StatsPeriod] = None,
        stat: OverviewStat = None,
    ):
        if stat is None:
            stat = "sessions"
        assert stat in ("sessions", "users")
        now = datetime.now(pytz.utc)
        _, summary_start, _ = get_rollup_starts_and_buckets(summary_stats_period or "24h")

        org_id = self._get_org_id([x for x, _ in project_releases])

        where: List[Union[BooleanCondition, Condition]] = [
            Condition(Column("org_id"), Op.EQ, org_id),
            filter_projects_by_project_release(org_id, project_releases),
            Condition(Column("timestamp"), Op.GTE, summary_start),
            Condition(Column("timestamp"), Op.LT, now),
        ]

        if environments is not None:
            where.append(
                Condition(
                    Column(tag_key(org_id, "environment")),
                    Op.IN,
                    get_tag_values_list(org_id, environments),
                )
            )

        if health_stats_period:
            health_stats_data = self._get_health_stats_for_overview(
                where, org_id, health_stats_period, stat, now
            )
        else:
            health_stats_data = {}

        rv_durations = self._get_session_duration_data_for_overview(where, org_id)
        rv_errored_sessions = self._get_errored_sessions_for_overview(where, org_id)
        rv_sessions = self._get_abnormal_and_crashed_sessions_for_overview(where, org_id)
        rv_users = self._get_users_and_crashed_users_for_overview(where, org_id)

        # XXX: In order to be able to dual-read and compare results from both
        # old and new backend, this should really go back through the
        # release_health service instead of directly calling `self`. For now
        # that makes the entire backend too hard to test though.
        release_adoption = self.get_release_adoption(project_releases, environments)

        rv = {}

        fetch_has_health_data_releases = set()

        for project_id, release in project_releases:
            adoption_info = release_adoption.get((project_id, release)) or {}

            total_sessions = rv_sessions.get((project_id, release, "init"))

            total_users = rv_users.get((project_id, release, "init"))
            has_health_data = bool(total_sessions)

            # has_health_data is supposed to be irrespective of the currently
            # selected rollup window. Therefore we need to run another query
            # over 90d just to see if health data is available to compute
            # has_health_data correctly.
            if not has_health_data and summary_stats_period != "90d":
                fetch_has_health_data_releases.add((project_id, release))

            sessions_crashed = rv_sessions.get((project_id, release, "crashed"), 0)

            users_crashed = rv_users.get((project_id, release, "crashed"), 0)

            rv_row = rv[project_id, release] = {
                "adoption": adoption_info.get("adoption"),
                "sessions_adoption": adoption_info.get("sessions_adoption"),
                "total_users_24h": adoption_info.get("users_24h"),
                "total_project_users_24h": adoption_info.get("project_users_24h"),
                "total_sessions_24h": adoption_info.get("sessions_24h"),
                "total_project_sessions_24h": adoption_info.get("project_sessions_24h"),
                "total_sessions": total_sessions,
                "total_users": total_users,
                "has_health_data": has_health_data,
                "sessions_crashed": sessions_crashed,
                "crash_free_users": (
                    100 - users_crashed / total_users * 100 if total_users else None
                ),
                "crash_free_sessions": (
                    100 - sessions_crashed / float(total_sessions) * 100 if total_sessions else None
                ),
                "sessions_errored": max(
                    0,
                    rv_errored_sessions.get((project_id, release), 0)
                    - sessions_crashed
                    - rv_sessions.get((project_id, release, "abnormal"), 0),
                ),
                **(
                    rv_durations.get((project_id, release))
                    or {
                        "duration_p50": None,
                        "duration_p90": None,
                    }
                ),
            }

            if health_stats_period:
                rv_row["stats"] = {health_stats_period: health_stats_data[project_id, release]}

        if fetch_has_health_data_releases:
            has_health_data = release_health.check_has_health_data(fetch_has_health_data_releases)  # type: ignore

            for key in fetch_has_health_data_releases:
                rv[key]["has_health_data"] = key in has_health_data

        return rv
