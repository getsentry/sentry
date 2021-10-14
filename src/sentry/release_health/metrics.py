from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Set, Tuple, Union

import pytz
from snuba_sdk import Column, Condition, Entity, Function, Op, Query
from snuba_sdk.expressions import Granularity
from snuba_sdk.query import SelectableExpression

from sentry.models import Environment
from sentry.models.project import Project
from sentry.release_health.base import (
    CrashFreeBreakdown,
    CurrentAndPreviousCrashFreeRates,
    EnvironmentName,
    OrganizationId,
    OverviewStat,
    ProjectId,
    ProjectOrRelease,
    ProjectRelease,
    ProjectWithCount,
    ReleaseAdoption,
    ReleaseHealthBackend,
    ReleaseHealthOverview,
    ReleaseName,
    ReleasesAdoption,
    ReleaseSessionsTimeBounds,
    SessionsQueryResult,
    StatsPeriod,
)
from sentry.release_health.metrics_sessions_v2 import run_sessions_query
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.sessions import _make_stats, get_rollup_starts_and_buckets, parse_snuba_datetime
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.snuba import QueryOutsideRetentionError, raw_snql_query


class MetricIndexNotFound(Exception):
    pass


def get_tag_values_list(org_id: int, values: Sequence[str]) -> Sequence[int]:
    return [x for x in [try_get_string_index(org_id, x) for x in values] if x is not None]


def metric_id(org_id: int, name: str) -> int:
    index = indexer.resolve(name)  # type: ignore
    if index is None:
        raise MetricIndexNotFound(name)
    return index  # type: ignore


def tag_key(org_id: int, name: str) -> str:
    index = indexer.resolve(name)  # type: ignore
    if index is None:
        raise MetricIndexNotFound(name)
    return f"tags[{index}]"


def tag_value(org_id: int, name: str) -> int:
    index = indexer.resolve(name)  # type: ignore
    if index is None:
        raise MetricIndexNotFound(name)
    return index  # type: ignore


def try_get_string_index(org_id: int, name: str) -> Optional[int]:
    return indexer.resolve(name)  # type: ignore


def reverse_tag_value(org_id: int, index: int) -> str:
    str_value = indexer.reverse_resolve(index)  # type: ignore
    # If the value can't be reversed it's very likely a real programming bug
    # instead of something to be caught down: We probably got back a value from
    # Snuba that's not in the indexer => partial data loss
    assert str_value is not None
    return str_value  # type: ignore


def filter_projects_by_project_release(project_releases: Sequence[ProjectRelease]) -> Condition:
    return Condition(Column("project_id"), Op.IN, list(x for x, _ in project_releases))


def filter_releases_by_project_release(
    org_id: int, project_releases: Sequence[ProjectRelease]
) -> Condition:
    return Condition(
        Column(tag_key(org_id, "release")),
        Op.IN,
        get_tag_values_list(org_id, [x for _, x in project_releases]),
    )


def _model_environment_ids_to_environment_names(
    environment_ids: Sequence[int],
) -> Mapping[int, Optional[str]]:
    """
    Maps Environment Model ids to the environment name
    Note: this does a Db lookup
    """
    empty_string_to_none: Callable[[Any], Optional[Any]] = lambda v: None if v == "" else v
    id_to_name: Mapping[int, Optional[str]] = {
        k: empty_string_to_none(v)
        for k, v in Environment.objects.filter(id__in=environment_ids).values_list("id", "name")
    }
    return defaultdict(lambda: None, id_to_name)


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
            match=Entity(EntityKey.MetricsCounters.value),
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

        return self._get_release_adoption_impl(now, org_id, project_releases, environments)

    @staticmethod
    def _get_release_adoption_impl(
        now: datetime,
        org_id: int,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleasesAdoption:
        start = now - timedelta(days=1)

        def _get_common_where(total: bool) -> List[Condition]:
            where_common: List[Condition] = [
                Condition(Column("org_id"), Op.EQ, org_id),
                filter_projects_by_project_release(project_releases),
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
                match=Entity(EntityKey.MetricsCounters.value),
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
                match=Entity(EntityKey.MetricsSets.value),
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
            release_tag_value = indexer.resolve(release)  # type: ignore
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

    def run_sessions_query(
        self,
        org_id: int,
        query: QueryDefinition,
        span_op: str,
    ) -> SessionsQueryResult:

        return run_sessions_query(org_id, query, span_op)

    def get_release_sessions_time_bounds(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        org_id: OrganizationId,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleaseSessionsTimeBounds:
        select: List[SelectableExpression] = [
            Function("min", [Column("timestamp")], "min"),
            Function("max", [Column("timestamp")], "max"),
        ]

        try:
            where: List[Condition] = [
                Condition(Column("org_id"), Op.EQ, org_id),
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column(tag_key(org_id, "release")), Op.EQ, tag_value(org_id, release)),
                Condition(Column("timestamp"), Op.GTE, datetime.min),
                Condition(Column("timestamp"), Op.LT, datetime.now(pytz.utc)),
            ]

            if environments is not None:
                env_filter = get_tag_values_list(org_id, environments)
                if not env_filter:
                    raise MetricIndexNotFound()

                where.append(Condition(Column(tag_key(org_id, "environment")), Op.IN, env_filter))
        except MetricIndexNotFound:
            # Some filter condition can't be constructed and therefore can't be
            # satisfied.
            #
            # Ignore return type because of https://github.com/python/mypy/issues/8533
            return {"sessions_lower_bound": None, "sessions_upper_bound": None}  # type: ignore

        # XXX(markus): We know that this combination of queries is not fully
        # equivalent to the sessions-table based backend. Example:
        #
        # 1. Session sid=x is started with timestamp started=n
        # 2. Same sid=x is updated with new payload with timestamp started=n - 1
        #
        # Old sessions backend would return [n - 1 ; n - 1] as range.
        # New metrics backend would return [n ; n - 1] as range.
        #
        # We don't yet know if this case is relevant. Session's started
        # timestamp shouldn't really change as session status is updated
        # though.

        try:
            # Take care of initial values for session.started by querying the
            # init counter. This should take care of most cases on its own.
            init_sessions_query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsCounters.value),
                select=select,
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
                    Condition(
                        Column(tag_key(org_id, "session.status")), Op.EQ, tag_value(org_id, "init")
                    ),
                ],
            )

            rows = raw_snql_query(
                init_sessions_query,
                referrer="release_health.metrics.get_release_sessions_time_bounds.init_sessions",
                use_cache=False,
            )["data"]
        except MetricIndexNotFound:
            rows = []

        try:
            # Take care of potential timestamp updates by looking at the metric
            # for session duration, which is emitted once a session is closed ("terminal state")
            #
            # There is a testcase checked in that tests specifically for a
            # session update that lowers session.started. We don't know if that
            # testcase matters particularly.
            terminal_sessions_query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsDistributions.value),
                select=select,
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session.duration")),
                ],
            )
            rows.extend(
                raw_snql_query(
                    terminal_sessions_query,
                    referrer="release_health.metrics.get_release_sessions_time_bounds.terminal_sessions",
                    use_cache=False,
                )["data"]
            )
        except MetricIndexNotFound:
            pass

        # This check is added because if there are no sessions found, then the
        # aggregations query return both the sessions_lower_bound and the
        # sessions_upper_bound as `0` timestamp and we do not want that behaviour
        # by default
        # P.S. To avoid confusion the `0` timestamp which is '1970-01-01 00:00:00'
        # is rendered as '0000-00-00 00:00:00' in clickhouse shell
        formatted_unix_start_time = datetime.utcfromtimestamp(0).strftime("%Y-%m-%dT%H:%M:%S+00:00")

        lower_bound: Optional[str] = None
        upper_bound: Optional[str] = None

        for row in rows:
            if set(row.values()) == {formatted_unix_start_time}:
                continue
            if lower_bound is None or row["min"] < lower_bound:
                lower_bound = row["min"]
            if upper_bound is None or row["max"] > upper_bound:
                upper_bound = row["max"]

        if lower_bound is None or upper_bound is None:
            return {"sessions_lower_bound": None, "sessions_upper_bound": None}  # type: ignore

        def iso_format_snuba_datetime(date: str) -> str:
            return datetime.strptime(date, "%Y-%m-%dT%H:%M:%S+00:00").isoformat()[:19] + "Z"

        return {  # type: ignore
            "sessions_lower_bound": iso_format_snuba_datetime(lower_bound),
            "sessions_upper_bound": iso_format_snuba_datetime(upper_bound),
        }

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
            releases_ids = get_tag_values_list(org_id, releases)
            where_clause.append(Condition(Column(release_column_name), Op.IN, releases_ids))
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
            match=Entity(EntityKey.MetricsCounters.value),
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
            match=Entity(EntityKey.MetricsCounters.value),
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
        where: List[Condition], org_id: int
    ) -> Mapping[Tuple[int, str], Any]:
        """
        Percentiles of session duration
        """
        rv_durations: Dict[Tuple[int, str], Any] = {}

        release_column_name = tag_key(org_id, "release")
        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
        ]

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsDistributions.value),
                select=aggregates + [Column("percentiles")],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session.duration")),
                    Condition(
                        Column(tag_key(org_id, "session.status")),
                        Op.EQ,
                        tag_value(org_id, "exited"),
                    ),
                ],
                groupby=aggregates,
            ),
            referrer="release_health.metrics.get_session_duration_data_for_overview",
        )["data"]:
            # See https://github.com/getsentry/snuba/blob/8680523617e06979427bfa18c6b4b4e8bf86130f/snuba/datasets/entities/metrics.py#L184 for quantiles
            key = (row["project_id"], reverse_tag_value(org_id, row[release_column_name]))
            rv_durations[key] = {
                "duration_p50": row["percentiles"][0],
                "duration_p90": row["percentiles"][2],
            }

        return rv_durations

    @staticmethod
    def _get_errored_sessions_for_overview(
        where: List[Condition], org_id: int
    ) -> Mapping[Tuple[int, str], int]:
        """
        Count of errored sessions, incl fatal (abnormal, crashed) sessions
        """
        rv_errored_sessions: Dict[Tuple[int, str], int] = {}

        release_column_name = tag_key(org_id, "release")
        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
        ]

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsSets.value),
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
    def _get_session_by_status_for_overview(
        where: List[Condition], org_id: int
    ) -> Mapping[Tuple[int, str, str], int]:
        """
        Counts of init, abnormal and crashed sessions, purpose-built for overview
        """
        release_column_name = tag_key(org_id, "release")
        session_status_column_name = tag_key(org_id, "session.status")

        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
            Column(session_status_column_name),
        ]

        rv_sessions: Dict[Tuple[int, str, str], int] = {}

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsCounters.value),
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
        where: List[Condition], org_id: int
    ) -> Mapping[Tuple[int, str, str], int]:
        release_column_name = tag_key(org_id, "release")
        session_status_column_name = tag_key(org_id, "session.status")

        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
            Column(session_status_column_name),
        ]

        # Count of users and crashed users
        rv_users: Dict[Tuple[int, str, str], int] = {}

        # Avoid mutating input parameters here
        select = aggregates + [Column("value")]
        where = where + [
            Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "user")),
            Condition(
                Column(session_status_column_name),
                Op.IN,
                get_tag_values_list(org_id, ["crashed", "init"]),
            ),
        ]

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsSets.value),
                select=select,
                where=where,
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
        where: List[Condition],
        org_id: int,
        health_stats_period: StatsPeriod,
        stat: OverviewStat,
        now: datetime,
    ) -> Mapping[ProjectRelease, List[List[int]]]:
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

        rv: Dict[ProjectRelease, List[List[int]]] = defaultdict(lambda: _make_stats(stats_start, stats_rollup, stats_buckets))  # type: ignore

        entity = {
            "users": EntityKey.MetricsSets.value,
            "sessions": EntityKey.MetricsCounters.value,
        }[stat]

        metric_name = metric_id(org_id, {"sessions": "session", "users": "user"}[stat])

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(entity),
                select=aggregates + [Column("value")],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_name),
                    Condition(Column("timestamp"), Op.GTE, stats_start),
                    Condition(Column("timestamp"), Op.LT, now),
                    Condition(
                        Column(session_status_column_name),
                        Op.EQ,
                        session_init_tag_value,
                    ),
                ],
                granularity=Granularity(stats_rollup),
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
            if time_bucket < len(timeseries):
                timeseries[time_bucket][1] = row["value"]

        return rv

    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        summary_stats_period: Optional[StatsPeriod] = None,
        health_stats_period: Optional[StatsPeriod] = None,
        stat: Optional[OverviewStat] = None,
    ) -> Mapping[ProjectRelease, ReleaseHealthOverview]:
        if stat is None:
            stat = "sessions"
        assert stat in ("sessions", "users")
        now = datetime.now(pytz.utc)
        _, summary_start, _ = get_rollup_starts_and_buckets(summary_stats_period or "24h")

        org_id = self._get_org_id([x for x, _ in project_releases])

        where: List[Condition] = [
            Condition(Column("org_id"), Op.EQ, org_id),
            filter_projects_by_project_release(project_releases),
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
        rv_sessions = self._get_session_by_status_for_overview(where, org_id)
        rv_users = self._get_users_and_crashed_users_for_overview(where, org_id)

        # XXX: In order to be able to dual-read and compare results from both
        # old and new backend, this should really go back through the
        # release_health service instead of directly calling `self`. For now
        # that makes the entire backend too hard to test though.
        release_adoption = self.get_release_adoption(project_releases, environments)

        rv: Dict[ProjectRelease, ReleaseHealthOverview] = {}

        fetch_has_health_data_releases = set()

        default_adoption_info: ReleaseAdoption = {
            "adoption": None,
            "sessions_adoption": None,
            "users_24h": None,
            "project_users_24h": None,
            "sessions_24h": None,
            "project_sessions_24h": None,
        }

        for project_id, release in project_releases:
            adoption_info: ReleaseAdoption = (
                release_adoption.get((project_id, release)) or default_adoption_info
            )

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
                "duration_p50": None,
                "duration_p90": None,
            }

            durations = rv_durations.get((project_id, release))
            if durations:
                rv_row.update(durations)

            if health_stats_period:
                rv_row["stats"] = {health_stats_period: health_stats_data[project_id, release]}

        if fetch_has_health_data_releases:
            has_health_data = self.check_has_health_data(fetch_has_health_data_releases)  # type: ignore

            for key in fetch_has_health_data_releases:
                rv[key]["has_health_data"] = key in has_health_data  # type: ignore

        return rv

    def _get_crash_free_breakdown_fn(
        self,
        org_id: int,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Callable[[datetime], CrashFreeBreakdown]:
        def generate_defaults(end: datetime) -> CrashFreeBreakdown:
            """Function to use if querying snuba is not necessary"""
            return {
                "crash_free_sessions": None,
                "crash_free_users": None,
                "date": end,
                "total_sessions": 0,
                "total_users": 0,
            }

        # 1) Get required string indexes
        try:
            release_key = tag_key(org_id, "release")
            release_value = tag_value(org_id, release)
            environment_key = tag_key(org_id, "environment")
            status_key = tag_key(org_id, "session.status")
        except MetricIndexNotFound:
            # No need to query snuba if any of these is missing
            return generate_defaults

        environment_values = None
        if environments is not None:
            environment_values = get_tag_values_list(org_id, environments)

        if environment_values == []:
            # No need to query snuba with an empty list
            return generate_defaults

        status_init = try_get_string_index(org_id, "init")
        status_crashed = try_get_string_index(org_id, "crashed")

        conditions = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column(release_key), Op.EQ, release_value),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column(status_key), Op.IN, [status_init, status_crashed]),
        ]
        if environment_values is not None:
            conditions.append(Condition(Column(environment_key), Op.IN, environment_values))

        def query_stats(end: datetime) -> CrashFreeBreakdown:
            def _get_data(entity_key: EntityKey, metric_name: str) -> Tuple[int, int]:
                total = 0
                crashed = 0
                metric_id = try_get_string_index(org_id, metric_name)
                if metric_id is not None:
                    where = conditions + [
                        Condition(Column("metric_id"), Op.EQ, metric_id),
                        Condition(Column("timestamp"), Op.LT, end),
                    ]
                    data = raw_snql_query(
                        Query(
                            dataset=Dataset.Metrics.value,
                            match=Entity(entity_key.value),
                            select=[Column("value")],
                            where=where,
                            groupby=[Column(status_key)],
                        ),
                        referrer="release_health.metrics.crash-free-breakdown.session",
                    )["data"]
                    for row in data:
                        if row[status_key] == status_init:
                            total = int(row["value"])
                        elif row[status_key] == status_crashed:
                            crashed = int(row["value"])

                return total, crashed

            sessions_total, sessions_crashed = _get_data(EntityKey.MetricsCounters, "session")
            users_total, users_crashed = _get_data(EntityKey.MetricsSets, "user")

            return {
                "date": end,
                "total_users": users_total,
                "crash_free_users": 100 - users_crashed / float(users_total) * 100
                if users_total
                else None,
                "total_sessions": sessions_total,
                "crash_free_sessions": 100 - sessions_crashed / float(sessions_total) * 100
                if sessions_total
                else None,
            }

        return query_stats

    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Sequence[CrashFreeBreakdown]:

        org_id = self._get_org_id([project_id])

        now = datetime.now(pytz.utc)
        query_fn = self._get_crash_free_breakdown_fn(
            org_id, project_id, release, start, environments
        )

        last: Optional[datetime] = None
        rv = []
        for offset in (
            timedelta(days=1),
            timedelta(days=2),
            timedelta(days=7),
            timedelta(days=14),
            timedelta(days=30),
        ):
            try:
                end = start + offset
                if end > now:
                    if last is None or (end - last).days > 1:
                        rv.append(query_fn(now))
                    break
                rv.append(query_fn(end))
                last = end
            except QueryOutsideRetentionError:
                # cannot query for these
                pass

        return rv

    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
    ) -> Sequence[ProjectRelease]:

        now = datetime.now(pytz.utc)
        start = now - timedelta(days=3)

        project_ids = list(project_ids)

        if len(project_ids) == 0:
            return []

        org_id = self._get_org_id(project_ids)
        release_column_name = tag_key(org_id, "release")

        query_cols = [Column("project_id"), Column(release_column_name)]
        group_by = query_cols

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, now),
        ]

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=query_cols,
            where=where_clause,
            groupby=group_by,
        )
        result = raw_snql_query(
            query,
            referrer="release_health.metrics.get_changed_project_release_model_adoptions",
            use_cache=False,
        )

        def extract_row_info(row: Mapping[str, Union[OrganizationId, str]]) -> ProjectRelease:
            return row.get("project_id"), reverse_tag_value(org_id, row.get(release_column_name))  # type: ignore

        return [extract_row_info(row) for row in result["data"]]

    def get_oldest_health_data_for_releases(
        self,
        project_releases: Sequence[ProjectRelease],
    ) -> Mapping[ProjectRelease, str]:

        now = datetime.now(pytz.utc)
        start = now - timedelta(days=90)

        project_ids: List[ProjectId] = [x[0] for x in project_releases]
        org_id = self._get_org_id(project_ids)
        release_column_name = tag_key(org_id, "release")
        releases = [x[1] for x in project_releases]
        releases_ids = [
            release_id
            for release_id in [try_get_string_index(org_id, release) for release in releases]
            if release_id is not None
        ]

        query_cols = [
            Column("project_id"),
            Column(release_column_name),
            Function("min", [Column("bucketed_time")], "oldest"),
        ]

        group_by = [
            Column("project_id"),
            Column(release_column_name),
        ]

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, now),
            Condition(Column(release_column_name), Op.IN, releases_ids),
        ]

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=query_cols,
            where=where_clause,
            groupby=group_by,
            granularity=Granularity(3600),
        )
        rows = raw_snql_query(
            query,
            referrer="release_health.metrics.get_oldest_health_data_for_releases",
            use_cache=False,
        )["data"]

        result = {}

        for row in rows:
            result[row["project_id"], reverse_tag_value(org_id, row[release_column_name])] = row[
                "oldest"
            ]

        return result

    def get_project_releases_count(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> int:

        if stats_period is None:
            stats_period = "24h"

        # Special rule that we support sorting by the last 24h only.
        if scope.endswith("_24h"):
            stats_period = "24h"

        granularity, stats_start, _ = get_rollup_starts_and_buckets(stats_period)
        where = [
            Condition(Column("timestamp"), Op.GTE, stats_start),
            Condition(Column("timestamp"), Op.LT, datetime.now()),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("org_id"), Op.EQ, organization_id),
        ]

        try:
            release_column_name = tag_key(organization_id, "release")
        except MetricIndexNotFound:
            return 0

        if environments is not None:
            try:
                environment_column_name = tag_key(organization_id, "environment")
            except MetricIndexNotFound:
                return 0

            environment_values = get_tag_values_list(organization_id, environments)
            where.append(Condition(Column(environment_column_name), Op.IN, environment_values))

        having = []

        # Filter out releases with zero users when sorting by either `users` or `crash_free_users`
        if scope in ["users", "crash_free_users"]:
            having.append(Condition(Column("value"), Op.GT, 0))
            match = Entity(EntityKey.MetricsSets.value)
        else:
            match = Entity(EntityKey.MetricsCounters.value)

        query_columns = [
            Function(
                "uniqExact", [Column(release_column_name), Column("project_id")], alias="count"
            )
        ]

        query = Query(
            dataset=Dataset.Metrics.value,
            match=match,
            select=query_columns,
            where=where,
            having=having,
            granularity=Granularity(granularity),
        )

        rows = raw_snql_query(query, referrer="release_health.metrics.get_project_releases_count")[
            "data"
        ]

        ret_val: int = rows[0]["count"] if rows else 0
        return ret_val

    def get_project_sessions_count(
        self,
        project_id: ProjectId,
        rollup: int,  # rollup in seconds
        start: datetime,
        end: datetime,
        environment_id: Optional[int] = None,
    ) -> int:

        org_id = self._get_org_id([project_id])
        columns = [Column("value")]

        try:
            status_key = tag_key(org_id, "session.status")
            status_init = tag_value(org_id, "init")
        except MetricIndexNotFound:
            return 0

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column(status_key), Op.EQ, status_init),
        ]

        if environment_id is not None:
            # convert the PosgreSQL environmentID into the clickhouse string index
            # for the environment name
            env_names = _model_environment_ids_to_environment_names([environment_id])
            env_name = env_names[environment_id]
            if env_name is None:
                return 0  # could not find the requested environment

            try:
                snuba_env_id = tag_value(org_id, env_name)
                env_id = tag_key(org_id, "environment")
            except MetricIndexNotFound:
                return 0

            where_clause.append(Condition(Column(env_id), Op.EQ, snuba_env_id))

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=columns,
            where=where_clause,
            granularity=Granularity(rollup),
        )

        rows = raw_snql_query(query, referrer="release_health.metrics.get_project_sessions_count")[
            "data"
        ]

        ret_val: int = rows[0]["value"] if rows else 0
        return ret_val

    def get_num_sessions_per_project(
        self,
        project_ids: Sequence[ProjectId],
        start: datetime,
        end: datetime,
        environment_ids: Optional[Sequence[int]] = None,
        rollup: Optional[int] = None,  # rollup in seconds
    ) -> Sequence[ProjectWithCount]:

        org_id = self._get_org_id(project_ids)
        columns = [Column("value"), Column("project_id")]

        try:
            status_key = tag_key(org_id, "session.status")
            status_init = tag_value(org_id, "init")
        except MetricIndexNotFound:
            return []

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("metric_id"), Op.EQ, metric_id(org_id, "session")),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column(status_key), Op.EQ, status_init),
            Condition(Column("project_id"), Op.IN, project_ids),
        ]

        if environment_ids is not None:
            # convert the PosgreSQL environmentID into the clickhouse string index
            # for the environment name
            env_names_dict = _model_environment_ids_to_environment_names(environment_ids)
            env_names = [value for value in env_names_dict.values() if value is not None]

            try:
                env_id = tag_key(org_id, "environment")
                snuba_env_ids = get_tag_values_list(org_id, env_names)
            except MetricIndexNotFound:
                return []

            where_clause.append(Condition(Column(env_id), Op.IN, snuba_env_ids))

        group_by = [Column("project_id")]

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=columns,
            where=where_clause,
            groupby=group_by,
            granularity=Granularity(rollup) if rollup is not None else None,
        )

        rows = raw_snql_query(
            query, referrer="release_health.metrics.get_num_sessions_per_project"
        )["data"]

        return [(row["project_id"], row["value"]) for row in rows]
