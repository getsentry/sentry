from datetime import datetime
from typing import Optional, Sequence, Set, Tuple, Union

from sentry.releasehealth.base import (
    CurrentAndPreviousCrashFreeRates,
    EnvironmentName,
    OrganizationId,
    ProjectId,
    ProjectRelease,
    ReleaseHealthBackend,
    ReleaseName,
)
from sentry.snuba.sessions import (
    _get_release_adoption,
    check_has_health_data,
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
    ) -> ReleaseHealthBackend.ReleasesAdoption:
        return _get_release_adoption(  # type: ignore
            project_releases=project_releases, environments=environments, now=now
        )

    def check_has_health_data(
        self, projects_list: Sequence[Union[ProjectId, ProjectRelease]]
    ) -> Set[Union[ProjectId, ProjectRelease]]:
        return check_has_health_data(projects_list)  # type: ignore
