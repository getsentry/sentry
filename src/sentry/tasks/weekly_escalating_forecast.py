import logging
from datetime import datetime, timedelta
from typing import Dict, List, TypedDict

from sentry_sdk.crons.decorator import monitor

from sentry.constants import ObjectStatus
from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry
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
    silo_mode=SiloMode.REGION,
)
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
    silo_mode=SiloMode.REGION,
)
@retry
def generate_forecasts_for_projects(project_ids: List[int]) -> None:
    query_until_escalating_groups = (
        group
        for group in RangeQuerySetWrapper(
            Group.objects.filter(
                status=GroupStatus.IGNORED,
                substatus=GroupSubStatus.UNTIL_ESCALATING,
                project_id__in=project_ids,
                last_seen__gte=datetime.now() - timedelta(days=7),
            ).select_related(
                "project", "project__organization"
            ),  # TODO: Remove this once the feature flag is removed
            step=ITERATOR_CHUNK,
        )
        if group.issue_type.should_detect_escalation(group.project.organization)
    )

    for until_escalating_groups in chunked(
        query_until_escalating_groups,
        ITERATOR_CHUNK,
    ):
        generate_and_save_forecasts(groups=until_escalating_groups)
