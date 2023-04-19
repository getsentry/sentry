import logging
from typing import Dict, List, TypedDict

from sentry_sdk.crons.decorator import monitor

from sentry.issues.forecasts import get_forecasts
from sentry.models import Group, GroupStatus
from sentry.tasks.base import instrumented_task
from sentry.types.group import GroupSubStatus


class GroupCount(TypedDict):
    intervals: List[str]
    data: List[int]


ParsedGroupsCount = Dict[int, GroupCount]

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.weekly_escalating_forecast.run_escalating_forecast",
    queue="weekly_escalating_forecast",
    max_retries=0,  # TODO: Increase this when the task is changed to run weekly
)  # type: ignore
@monitor(monitor_slug="escalating-issue-forecast-job-monitor")
def run_escalating_forecast() -> None:
    """
    Run the escalating forecast algorithm on archived until escalating issues.
    """
    logger.info("Starting task for sentry.tasks.weekly_escalating_forecast.run_escalating_forecast")
    # TODO: Do not limit to project id = 1 and limit 10 once these topics are clarified
    # TODO: If possible, fetch group_id instead of the entire group model
    until_escalating_groups = list(
        Group.objects.filter(
            status=GroupStatus.IGNORED,
            substatus=GroupSubStatus.UNTIL_ESCALATING,
            project__id=1,
        )[:10]
    )
    logger.info(
        "Checking for archived until escalating groups",
        extra={"has_groups": len(until_escalating_groups) > 0},
    )
    if not until_escalating_groups:
        return

    get_forecasts(until_escalating_groups)
