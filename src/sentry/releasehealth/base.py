from datetime import datetime
from typing import Dict, Optional, Sequence

from typing_extensions import TypedDict

from sentry.utils.services import Service


class ReleaseHealthBackend(Service):  # type: ignore
    """Abstraction layer for all release health related queries"""

    __all__ = ("get_current_and_previous_crash_free_rates",)

    class CurrentAndPreviousCrashFreeRate(TypedDict):
        currentCrashFreeRate: Optional[float]
        previousCrashFreeRate: Optional[float]

    CurrentAndPreviousCrashFreeRates = Dict[int, CurrentAndPreviousCrashFreeRate]

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
        """
        Function that returns `currentCrashFreeRate` and the `previousCrashFreeRate` of projects
        based on the inputs provided
        Inputs:
            * project_ids
            * current_start: start interval of currentCrashFreeRate
            * current_end: end interval of currentCrashFreeRate
            * previous_start: start interval of previousCrashFreeRate
            * previous_end: end interval of previousCrashFreeRate
            * rollup
        Returns:
            A dictionary of project_id as key and as value the `currentCrashFreeRate` and the
            `previousCrashFreeRate`

            As an example:
            {
                1: {
                    "currentCrashFreeRate": 100,
                    "previousCrashFreeRate": 66.66666666666667
                },
                2: {
                    "currentCrashFreeRate": 50.0,
                    "previousCrashFreeRate": None
                },
                ...
            }
        """
        raise NotImplementedError()
