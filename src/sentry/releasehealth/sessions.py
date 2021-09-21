from datetime import datetime
from typing import Optional, Sequence, Tuple

from sentry.releasehealth.base import (
    EnvironmentName,
    OrganizationId,
    ProjectId,
    ReleaseHealthBackend,
    ReleaseName,
)
from sentry.snuba.sessions import get_current_and_previous_crash_free_rates, get_release_adoption


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
    ) -> ReleaseHealthBackend.CurrentAndPreviousCrashFreeRates:
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
        return get_release_adoption(  # type: ignore
            project_releases=project_releases, environments=environments, now=now
        )
