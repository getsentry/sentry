from datetime import datetime
from typing import Optional, Sequence

from sentry.releasehealth.base import ReleaseHealthBackend
from sentry.snuba.sessions import get_current_and_previous_crash_free_rates, get_release_adoption


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
    ) -> ReleaseHealthBackend.CurrentAndPreviousCrashFreeRates:
        return get_current_and_previous_crash_free_rates(  # type: ignore
            project_ids=project_ids,
            current_start=current_start,
            current_end=current_end,
            previous_start=previous_start,
            previous_end=previous_end,
            rollup=rollup,
        )

    def get_release_adoption(self, project_releases, environments=None, now=None):
        """
        Get the adoption of the last 24 hours (or a difference reference timestamp).
        """

        return get_release_adoption(
            project_releases=project_releases, environments=environments, now=now
        )
