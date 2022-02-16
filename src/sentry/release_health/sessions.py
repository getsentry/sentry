from copy import deepcopy
from datetime import datetime
from typing import Mapping, Optional, Sequence, Set, Tuple, Union

import sentry_sdk

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
    ReleaseHealthBackend,
    ReleaseHealthOverview,
    ReleaseName,
    ReleasesAdoption,
    ReleaseSessionsTimeBounds,
    SessionsQueryResult,
    StatsPeriod,
)
from sentry.snuba.sessions import (
    _check_has_health_data,
    _check_releases_have_health_data,
    _get_changed_project_release_model_adoptions,
    _get_crash_free_breakdown,
    _get_num_sessions_per_project,
    _get_oldest_health_data_for_releases,
    _get_project_release_stats,
    _get_project_releases_by_stability,
    _get_project_releases_count,
    _get_project_sessions_count,
    _get_release_adoption,
    _get_release_health_data_overview,
    _get_release_sessions_time_bounds,
    get_current_and_previous_crash_free_rates,
)
from sentry.snuba.sessions_v2 import QueryDefinition, _run_sessions_query, massage_sessions_result


class SessionsReleaseHealthBackend(ReleaseHealthBackend):
    """Gets release health results from the session dataset"""

    def get_current_and_previous_crash_free_rates(
        self,
        project_ids: Sequence[ProjectId],
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime,
        rollup: int,
        org_id: Optional[OrganizationId] = None,
    ) -> CurrentAndPreviousCrashFreeRates:
        return get_current_and_previous_crash_free_rates(  # type: ignore
            project_ids=project_ids,
            current_start=current_start,
            current_end=current_end,
            previous_start=previous_start,
            previous_end=previous_end,
            rollup=rollup,
        )

    def get_release_adoption(
        self,
        project_releases: Sequence[Tuple[ProjectId, ReleaseName]],
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
        org_id: Optional[OrganizationId] = None,
    ) -> ReleasesAdoption:
        return _get_release_adoption(  # type: ignore
            project_releases=project_releases, environments=environments, now=now
        )

    def run_sessions_query(
        self,
        org_id: int,
        query: QueryDefinition,
        span_op: str,
    ) -> SessionsQueryResult:
        # This is necessary because if we are running against the `DuplexReleaseHealthBackend`, the
        # `query` object gets mutated, and that in turn affects the query results in subsequent
        # backend calls
        query_clone = deepcopy(query)

        with sentry_sdk.start_span(op=span_op, description="run_sessions_query"):
            totals, series = _run_sessions_query(query_clone)

        with sentry_sdk.start_span(op=span_op, description="massage_sessions_results"):
            return massage_sessions_result(query_clone, totals, series)  # type: ignore

    def get_release_sessions_time_bounds(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        org_id: OrganizationId,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleaseSessionsTimeBounds:
        return _get_release_sessions_time_bounds(  # type: ignore
            project_id=project_id, release=release, org_id=org_id, environments=environments
        )

    def check_has_health_data(
        self,
        projects_list: Sequence[ProjectOrRelease],
        now: Optional[datetime] = None,
    ) -> Set[ProjectOrRelease]:
        return _check_has_health_data(projects_list, now=now)  # type: ignore

    def check_releases_have_health_data(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        release_versions: Sequence[ReleaseName],
        start: datetime,
        end: datetime,
    ) -> Set[ReleaseName]:
        return _check_releases_have_health_data(  # type: ignore
            organization_id,
            project_ids,
            release_versions,
            start,
            end,
        )

    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        summary_stats_period: Optional[StatsPeriod] = None,
        health_stats_period: Optional[StatsPeriod] = None,
        stat: Optional[OverviewStat] = None,
        now: Optional[datetime] = None,
    ) -> Mapping[ProjectRelease, ReleaseHealthOverview]:
        return _get_release_health_data_overview(  # type: ignore
            project_releases=project_releases,
            environments=environments,
            summary_stats_period=summary_stats_period,
            health_stats_period=health_stats_period,
            stat=stat,
            now=now,
        )

    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
    ) -> Sequence[CrashFreeBreakdown]:
        return _get_crash_free_breakdown(  # type: ignore
            project_id=project_id, release=release, start=start, environments=environments, now=now
        )

    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
        now: Optional[datetime] = None,
    ) -> Sequence[ProjectRelease]:
        return _get_changed_project_release_model_adoptions(project_ids, now=now)  # type: ignore

    def get_oldest_health_data_for_releases(
        self,
        project_releases: Sequence[ProjectRelease],
        now: Optional[datetime] = None,
    ) -> Mapping[ProjectRelease, str]:
        return _get_oldest_health_data_for_releases(project_releases, now=now)  # type: ignore

    def get_project_releases_count(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> int:
        return _get_project_releases_count(  # type: ignore
            organization_id, project_ids, scope, stats_period, environments
        )

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
        return _get_project_release_stats(  # type: ignore
            project_id=project_id,
            release=release,
            stat=stat,
            rollup=rollup,
            start=start,
            end=end,
            environments=environments,
        )

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
        return _get_project_sessions_count(  # type: ignore
            project_id,
            rollup,
            start,
            end,
            environment_id,
        )

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
        return _get_num_sessions_per_project(  # type: ignore
            project_ids, start, end, environment_ids, rollup
        )

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
        return _get_project_releases_by_stability(  # type: ignore
            project_ids, offset, limit, scope, stats_period, environments, now
        )
