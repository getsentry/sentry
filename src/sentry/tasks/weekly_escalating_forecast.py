import logging
from datetime import datetime, timedelta
from typing import Dict, List, TypedDict

from django.db.models import Q
from sentry_sdk.crons.decorator import monitor

from sentry import features
from sentry.constants import ObjectStatus
from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.models import Group, GroupStatus, Organization, Project
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
)
@monitor(monitor_slug="escalating-issue-forecast-job-monitor")
def run_escalating_forecast() -> None:
    """
    Run the escalating forecast algorithm on archived until escalating issues.
    """
    logger.info("Starting task for sentry.tasks.weekly_escalating_forecast.run_escalating_forecast")
    for organization in RangeQuerySetWrapper(Organization.objects.all()):
        for project_ids in chunked(
            RangeQuerySetWrapper(
                Project.objects.filter(
                    status=ObjectStatus.ACTIVE, organization=organization
                ).values_list("id", flat=True),
                result_value_getter=lambda item: item,
                step=ITERATOR_CHUNK,
            ),
            ITERATOR_CHUNK,
        ):
            if features.has("organizations:escalating-issues-v2", organization):
                return generate_forecasts_for_projects.delay(
                    project_ids=project_ids, forecast_for_ongoing=True
                )

            return generate_forecasts_for_projects.delay(
                project_ids=project_ids, forecast_for_ongoing=False
            )


@instrumented_task(
    name="sentry.tasks.weekly_escalating_forecast.generate_forecasts_for_projects",
    queue="weekly_escalating_forecast",
    max_retries=3,
    default_retry_delay=60,
)
@retry
def generate_forecasts_for_projects(project_ids: List[int], forecast_for_ongoing=False) -> None:
    query_for_archived_until_escalating = Q(
        status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING
    )
    query_for_ongoing = Q(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)

    combined_query = (
        (query_for_archived_until_escalating | query_for_ongoing)
        if forecast_for_ongoing
        else query_for_archived_until_escalating
    )

    for until_escalating_groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                project_id__in=project_ids,
                last_seen__gte=datetime.now() - timedelta(days=7),
            ).filter(combined_query),
            step=ITERATOR_CHUNK,
        ),
        ITERATOR_CHUNK,
    ):
        generate_and_save_forecasts(groups=until_escalating_groups)
