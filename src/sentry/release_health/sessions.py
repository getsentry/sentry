from datetime import datetime
from typing import Optional, Sequence, Set, Tuple

from sentry.release_health.base import (
    CurrentAndPreviousCrashFreeRates,
    EnvironmentName,
    OrganizationId,
    ProjectId,
    ProjectOrRelease,
    ProjectRelease,
    ReleaseHealthBackend,
    ReleaseName,
    ReleasesAdoption,
    ReleaseSessionsTimeBounds,
)
from sentry.snuba.sessions import (
    _check_has_health_data,
    _check_releases_have_health_data,
    _get_changed_project_release_model_adoptions,
    _get_release_adoption,
    _get_release_sessions_time_bounds,
    get_current_and_previous_crash_free_rates,
)


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
        self, projects_list: Sequence[ProjectOrRelease]
    ) -> Set[ProjectOrRelease]:
        return _check_has_health_data(projects_list)  # type: ignore

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

    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
    ) -> Sequence[ProjectRelease]:
        return _get_changed_project_release_model_adoptions(project_ids)  # type: ignore
