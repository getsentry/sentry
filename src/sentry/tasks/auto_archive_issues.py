import logging
from datetime import datetime, timedelta
from typing import List

import pytz
from sentry_sdk.crons.decorator import monitor

from sentry import features
from sentry.models import (
    Activity,
    Group,
    GroupHistory,
    GroupHistoryStatus,
    GroupStatus,
    ObjectStatus,
    Organization,
    OrganizationStatus,
    Project,
    record_group_history_from_activity_type,
    remove_group_from_inbox,
)
from sentry.tasks.base import instrumented_task
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

ITERATOR_CHUNK = 10_000


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_ongoing_to_archived",
    queue="auto_transition_issue_states",
    max_retries=0,  # TODO: Increase this when the task is changed to run weekly
)  # type: ignore
@monitor(monitor_slug="auto-archive-job-monitor")
def run_auto_archive() -> None:
    """
    Automatically transition issues that are ongoing for 14 days to archived until escalating.
    """
    logger.info("Starting task for sentry.tasks.weekly_escalating_forecast.run_escalating_forecast")

    for organization in RangeQuerySetWrapper(
        Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    ):
        if features.has("organizations:escalating-issues", organization):
            project_ids = list(
                Project.objects.filter(
                    organization_id=organization.id, status=ObjectStatus.ACTIVE
                ).values_list("id", flat=True)
            )
            run_auto_achive_for_projects.delay(project_ids=project_ids)


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_ongoing_to_archived_for_projects",
    queue="auto_transition_issue_states",
    max_retries=3,
    default_retry_delay=60,
)  # type: ignore
def run_auto_achive_for_projects(project_ids: List[int]) -> None:
    now = datetime.now(tz=pytz.UTC)
    fourteen_days_ago = now - timedelta(days=14)

    for ongoing_groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.ONGOING,
                project_id__in=project_ids,
                last_seen__gte=datetime.now() - timedelta(days=14),
            ),
            step=ITERATOR_CHUNK,
        ),
        ITERATOR_CHUNK,
    ):

        for group in ongoing_groups:
            current_group_history = (
                GroupHistory.objects.filter(group=group).order_by("-date_added").first()
            )
            if not current_group_history:
                continue

            if not current_group_history.status == GroupHistoryStatus.ONGOING:
                continue

            if current_group_history.date_added <= fourteen_days_ago:
                group.update(status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING)

                remove_group_from_inbox(group)

                Activity.objects.create_group_activity(
                    group,
                    ActivityType.SET_IGNORED,
                    data={
                        "ignoreUntilEscalating": True,
                    },
                    send_notification=False,
                )

                record_group_history_from_activity_type(
                    group, activity_type=ActivityType.SET_IGNORED.value, actor=None
                )
