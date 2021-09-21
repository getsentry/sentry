from datetime import datetime
from typing import Optional, Sequence, Set

from sentry.releasehealth.base import (
    CurrentAndPreviousCrashFreeRates,
    ProjectList,
    ProjectRelease,
    ReleaseHealthBackend,
)
from sentry.snuba.sessions import check_has_health_data, get_current_and_previous_crash_free_rates


class SessionsReleaseHealthBackend(ReleaseHealthBackend):
    """Gets release health results from the session dataset"""

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
        return get_current_and_previous_crash_free_rates(  # type: ignore
            project_ids=project_ids,
            current_start=current_start,
            current_end=current_end,
            previous_start=previous_start,
            previous_end=previous_end,
            rollup=rollup,
        )

    def check_has_health_data(self, projects_list: ProjectList) -> Set[ProjectRelease]:
        return check_has_health_data(projects_list)
