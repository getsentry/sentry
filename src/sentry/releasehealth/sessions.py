from datetime import datetime
from typing import Any, Dict, Mapping, Optional, Sequence, cast

from sentry.releasehealth.base import ReleaseHealthBackend
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_query


class SessionsReleaseHealthBackend(ReleaseHealthBackend):
    """Gets release health results from the session dataset"""

    def get_current_and_previous_crash_free_rates(
        self,
        org_id: int,
        project_ids: Sequence[int],
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime,
        rollup: int,
    ) -> ReleaseHealthBackend.CurrentAndPreviousCrashFreeRates:
        projects_crash_free_rate_dict: ReleaseHealthBackend.CurrentAndPreviousCrashFreeRates = {
            prj: {"currentCrashFreeRate": None, "previousCrashFreeRate": None}
            for prj in project_ids
        }

        def calculate_crash_free_percentage(row: Mapping[str, Any]) -> Optional[float]:
            # XXX: Calculation is done in this way to clamp possible negative values and so to calculate
            # crash free rates similar to how it is calculated here
            # Ref: https://github.com/getsentry/sentry/pull/25543
            healthy_sessions = max(row["sessions"] - row["sessions_errored"], 0)
            errored_sessions = max(
                row["sessions_errored"] - row["sessions_crashed"] - row["sessions_abnormal"], 0
            )
            totals = (
                healthy_sessions
                + errored_sessions
                + row["sessions_crashed"]
                + row["sessions_abnormal"]
            )
            try:
                crash_free_rate: Optional[float] = 100 - (row["sessions_crashed"] / totals) * 100
            except ZeroDivisionError:
                crash_free_rate = None
            return crash_free_rate

        # currentCrashFreeRate
        current_crash_free_data = self._get_crash_free_rate_data(
            project_ids=project_ids,
            start=current_start,
            end=current_end,
            rollup=rollup,
        )
        for row in current_crash_free_data:
            projects_crash_free_rate_dict[row["project_id"]].update(
                {"currentCrashFreeRate": calculate_crash_free_percentage(row)}
            )

        # previousCrashFreeRate
        previous_crash_free_data = self._get_crash_free_rate_data(
            project_ids=project_ids,
            start=previous_start,
            end=previous_end,
            rollup=rollup,
        )
        for row in previous_crash_free_data:
            projects_crash_free_rate_dict[row["project_id"]].update(
                {"previousCrashFreeRate": calculate_crash_free_percentage(row)}
            )

        return projects_crash_free_rate_dict

    @staticmethod
    def _get_crash_free_rate_data(
        project_ids: Sequence[int],
        start: datetime,
        end: datetime,
        rollup: int,
    ) -> Sequence[Mapping[str, Any]]:
        """
        Helper function that executes a snuba query on project_ids to fetch the number of crashed
        sessions and total sessions and returns the crash free rate for those project_ids.
        Inputs:
            * project_ids
            * start
            * end
            * rollup
        Returns:
            Snuba query results
        """
        return cast(
            Sequence[Mapping[str, Any]],
            raw_query(
                dataset=Dataset.Sessions,
                selected_columns=[
                    "project_id",
                    "sessions_crashed",
                    "sessions_errored",
                    "sessions_abnormal",
                    "sessions",
                ],
                filter_keys={"project_id": project_ids},
                start=start,
                end=end,
                rollup=rollup,
                groupby=["project_id"],
                referrer="sessions.totals",
            )["data"],
        )
