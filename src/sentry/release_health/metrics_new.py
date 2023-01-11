# import itertools
import logging

# from collections import defaultdict
from datetime import datetime, timedelta

# from operator import itemgetter
from typing import Any, Dict, List, Literal, Mapping, Optional, Sequence, Set, Tuple, TypeVar, Union

import pytz
from snuba_sdk import Column, Condition, Entity, Function, Op, Query, Request
from snuba_sdk.expressions import Granularity
from snuba_sdk.query import SelectableExpression

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
    ProjectReleaseSessionStats,
    ProjectReleaseUserStats,
    ProjectWithCount,
    ReleaseAdoption,
    ReleaseHealthBackend,
    ReleaseHealthOverview,
    ReleaseName,
    ReleasesAdoption,
    ReleaseSessionsTimeBounds,
    SessionsQueryConfig,
    SessionsQueryResult,
    SnubaAppID,
    StatsPeriod,
)
from sentry.release_health.metrics_sessions_v2 import run_sessions_query
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.utils import (  # reverse_resolve,
    MetricIndexNotFound,
    resolve,
    resolve_many_weak,
    resolve_tag_key,
    resolve_weak,
)
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics import MetricField, MetricGroupByField, MetricsQuery, get_series
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.sessions_v2 import AllowedResolution, QueryDefinition
from sentry.utils.safe import get_path
from sentry.utils.snuba import raw_snql_query

SMALLEST_METRICS_BUCKET = 10

# Whenever a snuba query agains the old sessions table is done without both 1)
# an explicit rollup 2) a groupby some timestamp/bucket, Snuba will pick a
# default rollup of 3600 and pick sessions_hourly_dist over sessions_raw_dist,
# regardless of the timerange chosen.
#
# In order to make functional comparison easier, the metrics implementation
# (explicitly) chooses the same rollup in the equivalent queries, and uses this
# constant to denote that case.
LEGACY_SESSIONS_DEFAULT_ROLLUP = 3600
USE_CASE_ID = UseCaseKey.RELEASE_HEALTH

logger = logging.getLogger(__name__)

_K1 = TypeVar("_K1")
_K2 = TypeVar("_K2")
_V = TypeVar("_V")


def filter_projects_by_project_release(project_releases: Sequence[ProjectRelease]) -> Condition:
    return Condition(Column("project_id"), Op.IN, [proj for proj, _rel in project_releases])


def filter_releases_by_project_release(project_releases: Sequence[ProjectRelease]) -> Condition:
    return Condition(
        lhs=Column(name="tags[release]"),
        op=Op.IN,
        rhs=[rel for _proj, rel in project_releases],
    )


class MetricsLayerReleaseHealthBackend(ReleaseHealthBackend):
    """
    Implementation of the ReleaseHealthBackend using the MetricsLayer API
    """

    @staticmethod
    def _get_org_id(project_ids: Sequence[int]) -> int:
        return MetricsLayerReleaseHealthBackend._get_projects_and_org_id(project_ids)[1]

    @staticmethod
    def _get_projects(project_ids: Sequence[int]) -> Sequence[Project]:
        return MetricsLayerReleaseHealthBackend._get_projects_and_org_id(project_ids)[0]

    @staticmethod
    def _get_projects_and_org_id(project_ids: Sequence[int]) -> Tuple[Sequence[Project], int]:
        projects = Project.objects.get_many_from_cache(project_ids)
        org_ids: Set[int] = {project.organization_id for project in projects}
        if len(org_ids) != 1:
            raise ValueError("Expected projects to be from the same organization")

        return projects, org_ids.pop()

    @staticmethod
    def _get_crash_free_rate_data(
        org_id: int,
        projects: Sequence[Project],
        start: datetime,
        end: datetime,
        rollup: int,
    ) -> Dict[int, Dict[str, float]]:

        project_ids = [p.id for p in projects]

        select = [
            MetricField(metric_mri=SessionMRI.CRASHED.value, alias="crashed", op=None),
            # named it 'init' to keep the same name as the original tag
            MetricField(metric_mri=SessionMRI.ALL.value, alias="init", op=None),
        ]

        groupby = [
            MetricGroupByField(field="project_id"),
        ]
        query = MetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=end,
            granularity=Granularity(rollup),
            groupby=groupby,
        )
        result = get_series(projects=projects, metrics_query=query, use_case_id=USE_CASE_ID)

        groups = get_path(result, "groups", default=[])
        ret_val = {}
        for group in groups:
            project_id = get_path(group, "by", "project_id")
            assert project_id is not None
            totals = get_path(group, "totals")
            assert totals is not None
            ret_val[project_id] = totals

        return ret_val

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

    def is_metrics_based(self) -> bool:
        return True

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

        projects, proj_org_id = self._get_projects_and_org_id(project_ids)

        if org_id is None:
            org_id = proj_org_id
        else:
            if org_id != proj_org_id:
                # the specified org_id is not the projects' organization
                raise ValueError("Expected projects to be from the specified organization")

        projects_crash_free_rate_dict: CurrentAndPreviousCrashFreeRates = {
            prj: {"currentCrashFreeRate": None, "previousCrashFreeRate": None}
            for prj in project_ids
        }
        previous = self._get_crash_free_rate_data(
            org_id,
            projects,
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
            projects,
            current_start,
            current_end,
            rollup,
        )

        for project_id, project_data in current.items():
            projects_crash_free_rate_dict[project_id][
                "currentCrashFreeRate"
            ] = self._compute_crash_free_rate(project_data)

        return projects_crash_free_rate_dict

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
        project_ids = [proj for proj, _rel in project_releases]
        projects = MetricsLayerReleaseHealthBackend._get_projects(project_ids)

        def _get_common_where(total: bool) -> List[Condition]:
            where_common: List[Condition] = [
                filter_projects_by_project_release(project_releases),
            ]

            if environments is not None:
                where_common.append(
                    Condition(
                        lhs=Column("tags[environment]"),
                        op=Op.IN,
                        rhs=environments,
                    )
                )

            if not total:
                where_common.append(filter_releases_by_project_release(project_releases))

            return where_common

        def _get_common_groupby(total: bool) -> List[MetricGroupByField]:
            if total:
                return [MetricGroupByField(field="project_id")]
            else:
                return [
                    MetricGroupByField(field="project_id"),
                    MetricGroupByField(field="release"),
                ]

        def _convert_results(groups: Any, total: bool) -> Dict[Any, int]:
            """
            Converts the result groups into an array of values:

            from [{ "by": {"project_id": 123, "release": "r1"}, "totals": {"init": 23.3}},...]
            to:
             { 123: 23.3, ...} // for totals
             { (123, "r1"): 23.3, ...} // for details

            """
            ret_val = {}
            for group in groups:
                if total:
                    idx = get_path(group, "by", "project_id")
                else:
                    by = group.get("by", {})
                    idx = by.get("project_id"), by.get("release")
                ret_val[idx] = get_path(group, "totals", "value")
            return ret_val

        def _count_sessions(
            total: bool, project_ids: Sequence[int], referrer: str
        ) -> Dict[Any, int]:
            select = [
                MetricField(metric_mri=SessionMRI.ALL.value, alias="value", op=None),
            ]

            query = MetricsQuery(
                org_id=org_id,
                start=start,
                end=now,
                project_ids=project_ids,
                select=select,
                groupby=_get_common_groupby(total),
                where=_get_common_where(total),
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
                include_series=False,
                include_totals=True,
            )
            raw_result = get_series(projects=projects, metrics_query=query, use_case_id=USE_CASE_ID)

            return _convert_results(raw_result["groups"], total=total)

        def _count_users(total: bool, referrer: str) -> Dict[Any, int]:
            select = [
                MetricField(metric_mri=SessionMRI.USER.value, alias="value", op="count_unique")
            ]
            query = MetricsQuery(
                org_id=org_id,
                start=start,
                end=now,
                project_ids=project_ids,
                select=select,
                groupby=_get_common_groupby(total),
                where=_get_common_where(total),
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
                include_series=False,
                include_totals=True,
            )
            raw_result = get_series(projects=projects, metrics_query=query, use_case_id=USE_CASE_ID)
            return _convert_results(raw_result["groups"], total)

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
            total=True,
            project_ids=project_ids,
            referrer="release_health.metrics.get_release_adoption.total_sessions",
        )
        users_per_project: Dict[int, int] = _count_users(
            total=True, referrer="release_health.metrics.get_release_adoption.total_users"
        )

        # Count of sessions/users for given list of environments and timerange AND GIVEN RELEASES, per-project
        sessions_per_release: Dict[Tuple[int, str], int] = _count_sessions(
            total=False,
            project_ids=project_ids,
            referrer="release_health.metrics.get_release_adoption.releases_sessions",
        )
        users_per_release: Dict[Tuple[int, str], int] = _count_users(
            total=False, referrer="release_health.metrics.get_release_adoption.releases_users"
        )

        rv = {}

        for project_id, release in project_releases:
            release_tag_value = indexer.resolve(USE_CASE_ID, org_id, release)
            if release_tag_value is None:
                # Don't emit empty releases -- for exact compatibility with
                # sessions table backend.
                continue

            release_sessions = sessions_per_release.get((project_id, release), 0.0)
            release_users = users_per_release.get((project_id, release), 0.0)

            total_sessions = sessions_per_project.get(project_id, 0.0)
            total_users = users_per_project.get(project_id, 0.0)

            if (
                release_sessions is None
                or release_users is None
                or total_sessions is None
                or total_users is None
            ):
                continue

            adoption: ReleaseAdoption = {
                "adoption": release_users / total_users * 100
                if release_users and total_users
                else None,
                "sessions_adoption": release_sessions / total_sessions * 100
                if release_sessions and total_sessions
                else None,
                "users_24h": int(release_users),
                "sessions_24h": int(release_sessions),
                "project_users_24h": int(total_users),
                "project_sessions_24h": int(total_sessions),
            }

            rv[project_id, release] = adoption

        return rv

    def sessions_query_config(self, organization: Any, start: datetime) -> SessionsQueryConfig:
        return SessionsQueryConfig(
            allowed_resolution=AllowedResolution.ten_seconds,
            allow_session_status_query=True,
            restrict_date_range=False,
        )

    def run_sessions_query(
        self,
        org_id: int,
        query: QueryDefinition,
        span_op: str,
    ) -> SessionsQueryResult:
        return run_sessions_query(org_id, query, span_op)

    # TODO reevaluate if we want to use the metric layer (at the moment we don't)
    def get_release_sessions_time_bounds(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        org_id: OrganizationId,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleaseSessionsTimeBounds:
        """
        Note: this is copied as is from the old metrics implementation, it does NOT use the Metrics Layer
        """
        select: List[SelectableExpression] = [
            Function("min", [Column("timestamp")], "min"),
            Function("max", [Column("timestamp")], "max"),
        ]

        try:
            where: List[Condition] = [
                Condition(Column("org_id"), Op.EQ, org_id),
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(
                    Column(resolve_tag_key(USE_CASE_ID, org_id, "release")),
                    Op.EQ,
                    resolve_weak(USE_CASE_ID, org_id, release),
                ),
                Condition(
                    Column("timestamp"), Op.GTE, datetime(2008, 5, 8)
                ),  # Date of sentry's first commit
                Condition(
                    Column("timestamp"), Op.LT, datetime.now(pytz.utc) + timedelta(seconds=10)
                ),
            ]

            if environments is not None:
                env_filter = resolve_many_weak(USE_CASE_ID, org_id, environments)
                if not env_filter:
                    raise MetricIndexNotFound()

                where.append(
                    Condition(
                        Column(resolve_tag_key(USE_CASE_ID, org_id, "environment")),
                        Op.IN,
                        env_filter,
                    )
                )
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
                match=Entity(EntityKey.MetricsCounters.value),
                select=select,
                where=where
                + [
                    Condition(
                        Column("metric_id"),
                        Op.EQ,
                        resolve(USE_CASE_ID, org_id, SessionMRI.SESSION.value),
                    ),
                    Condition(
                        Column(resolve_tag_key(USE_CASE_ID, org_id, "session.status")),
                        Op.EQ,
                        resolve_weak(USE_CASE_ID, org_id, "init"),
                    ),
                ],
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            )
            request = Request(
                dataset=Dataset.Metrics.value, app_id=SnubaAppID, query=init_sessions_query
            )
            rows = raw_snql_query(
                request,
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
                match=Entity(EntityKey.MetricsDistributions.value),
                select=select,
                where=where
                + [
                    Condition(
                        Column("metric_id"),
                        Op.EQ,
                        resolve(USE_CASE_ID, org_id, SessionMRI.RAW_DURATION.value),
                    ),
                ],
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            )
            request = Request(
                dataset=Dataset.Metrics.value, app_id=SnubaAppID, query=terminal_sessions_query
            )
            rows.extend(
                raw_snql_query(
                    request,
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
        self,
        projects_list: Sequence[ProjectOrRelease],
        now: Optional[datetime] = None,
    ) -> Set[ProjectOrRelease]:
        if now is None:
            now = datetime.now(pytz.utc)

        start = now - timedelta(days=90)

        projects_list = list(projects_list)

        if len(projects_list) == 0:
            return set()

        includes_releases = isinstance(projects_list[0], tuple)

        if includes_releases:
            project_ids: List[ProjectId] = [x[0] for x in projects_list]  # type: ignore
        else:
            project_ids = projects_list  # type: ignore

        projects, org_id = self._get_projects_and_org_id(project_ids)

        select = [MetricField(metric_mri=SessionMRI.SESSION.value, alias="value", op="sum")]

        where_clause = []
        groupby = [
            MetricGroupByField(field="project_id"),
        ]

        if includes_releases:
            where_clause.append(filter_releases_by_project_release(projects_list))
            groupby.append(MetricGroupByField(field="release"))

        query = MetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=now,
            granularity=Granularity(24 * 60 * 60),  # daily
            groupby=groupby,
            where=where_clause,
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )
        groups = raw_result["groups"]

        ret_val = set()
        for group in groups:
            if includes_releases:
                by = group.get("by", {})
                idx = by.get("project_id"), by.get("release")
                ret_val.add(idx)
            else:
                proj_id = get_path(group, "by", "project_id")
                ret_val.add(proj_id)
        return ret_val

    def check_releases_have_health_data(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        release_versions: Sequence[ReleaseName],
        start: datetime,
        end: datetime,
    ) -> Set[ReleaseName]:
        """
        Returns a set of all release versions that have health data within a given period of time.
        """

        projects, org_id = self._get_projects_and_org_id(project_ids)

        select = [MetricField(metric_mri=SessionMRI.SESSION.value, alias="value", op="sum")]
        groupby = [MetricGroupByField(field="release")]
        where_clause = [
            Condition(
                lhs=Column(name="tags[release]"),
                op=Op.IN,
                rhs=release_versions,
            )
        ]

        query = MetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=end,
            granularity=Granularity(60),
            groupby=groupby,
            where=where_clause,
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )

        groups = raw_result["groups"]

        ret_val = set()
        for group in groups:
            by = group.get("by", {})
            release = by.get("release")
            if release is not None:
                ret_val.add(release)
        return ret_val

    # TODO implement
    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        summary_stats_period: Optional[StatsPeriod] = None,
        health_stats_period: Optional[StatsPeriod] = None,
        stat: Optional[Literal["users", "sessions"]] = None,
        now: Optional[datetime] = None,
    ) -> Mapping[ProjectRelease, ReleaseHealthOverview]:
        """Checks quickly for which of the given project releases we have
        health data available.  The argument is a tuple of `(project_id, release_name)`
        tuples.  The return value is a set of all the project releases that have health
        data.
        """

        raise NotImplementedError()

    # TODO implement
    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
    ) -> Sequence[CrashFreeBreakdown]:
        """Get stats about crash free sessions and stats for the last 1, 2, 7, 14 and 30 days"""

    # TODO implement
    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
        now: Optional[datetime] = None,
    ) -> Sequence[ProjectRelease]:
        """
        Returns a sequence of tuples (ProjectId, ReleaseName) with the
        releases seen in the last 72 hours for the requested projects.
        """
        raise NotImplementedError()

    # TODO implement
    def get_oldest_health_data_for_releases(
        self,
        project_releases: Sequence[ProjectRelease],
        now: Optional[datetime] = None,
    ) -> Mapping[ProjectRelease, str]:
        """Returns the oldest health data we have observed in a release
        in 90 days.  This is used for backfilling.
        """
        raise NotImplementedError()

    # TODO implement
    def get_project_releases_count(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> int:
        """
        Fetches the total count of releases/project combinations
        """
        raise NotImplementedError()

    # TODO implement
    def get_project_release_stats(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        stat: OverviewStat,
        rollup: int,
        start: datetime,
        end: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Union[ProjectReleaseUserStats, ProjectReleaseSessionStats]:
        raise NotImplementedError()

    # TODO implement
    def get_project_sessions_count(
        self,
        project_id: ProjectId,
        rollup: int,  # rollup in seconds
        start: datetime,
        end: datetime,
        environment_id: Optional[int] = None,
    ) -> int:
        """
        Returns the number of sessions in the specified period (optionally
        filtered by environment)
        """
        raise NotImplementedError()

    # TODO implement
    def get_num_sessions_per_project(
        self,
        project_ids: Sequence[ProjectId],
        start: datetime,
        end: datetime,
        environment_ids: Optional[Sequence[int]] = None,
        rollup: Optional[int] = None,  # rollup in seconds
    ) -> Sequence[ProjectWithCount]:
        """
        Returns the number of sessions for each project specified.
        Additionally
        """
        raise NotImplementedError()

    # TODO implement
    def get_project_releases_by_stability(
        self,
        project_ids: Sequence[ProjectId],
        offset: Optional[int],
        limit: Optional[int],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[str]] = None,
        now: Optional[datetime] = None,
    ) -> Sequence[ProjectRelease]:
        """Given some project IDs returns adoption rates that should be updated
        on the postgres tables.
        """
        raise NotImplementedError()
