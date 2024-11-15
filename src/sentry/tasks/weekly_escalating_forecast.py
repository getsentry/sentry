import logging
from datetime import UTC, datetime, timedelta
from typing import TypedDict

from sentry.constants import ObjectStatus
from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.types.group import GroupSubStatus
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper


class GroupCount(TypedDict):
    intervals: list[str]
    data: list[int]


ParsedGroupsCount = dict[int, GroupCount]

logger = logging.getLogger(__name__)

ITERATOR_CHUNK = 10_000


@instrumented_task(
    name="sentry.tasks.weekly_escalating_forecast.run_escalating_forecast",
    queue="weekly_escalating_forecast",
    max_retries=0,
    silo_mode=SiloMode.REGION,
)
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
def generate_forecasts_for_projects(project_ids: list[int]) -> None:
    for until_escalating_groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                status=GroupStatus.IGNORED,
                substatus=GroupSubStatus.UNTIL_ESCALATING,
                project_id__in=project_ids,
                last_seen__gte=datetime.now(UTC) - timedelta(days=7),
            ),
            step=ITERATOR_CHUNK,
        ),
        ITERATOR_CHUNK,
    ):
        generate_and_save_forecasts(groups=until_escalating_groups)
