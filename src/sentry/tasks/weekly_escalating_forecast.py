import logging
from datetime import datetime, timedelta
from typing import Dict, List, TypedDict

from sentry_sdk.crons.decorator import monitor

from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models import Group, GroupStatus, ObjectStatus, Project
from sentry.tasks.base import instrumented_task
from sentry.types.group import GroupSubStatus
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper


class GroupCount(TypedDict):
    intervals: List[str]
    data: List[int]


ParsedGroupsCount = Dict[int, GroupCount]

logger = logging.getLogger(__name__)

ITERATOR_CHUNK = 10_000


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

    for project_ids in chunked(
        RangeQuerySetWrapper(
            Project.objects.filter(status=ObjectStatus.ACTIVE).values_list("id", flat=True),
            result_value_getter=lambda item: item,
            step=ITERATOR_CHUNK,
        ),
        ITERATOR_CHUNK,
    ):
        generate_forecasts_for_projects.delay(project_ids=project_ids)


@instrumented_task(
    name="sentry.tasks.weekly_escalating_forecast.generate_forecasts_for_projects",
    queue="weekly_escalating_forecast",
    max_retries=3,
    default_retry_delay=60,
)  # type: ignore
def generate_forecasts_for_projects(project_ids: List[int]) -> None:
    for until_escalating_groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                status=GroupStatus.IGNORED,
                substatus=GroupSubStatus.UNTIL_ESCALATING,
                project_id__in=project_ids,
                last_seen__gte=datetime.now() - timedelta(days=7),
            ),
            step=ITERATOR_CHUNK,
        ),
        ITERATOR_CHUNK,
    ):
        generate_and_save_forecasts(groups=until_escalating_groups)
