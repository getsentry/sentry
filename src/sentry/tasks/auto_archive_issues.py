import logging
from datetime import datetime, timedelta
from typing import List

import pytz
from django.db.models import Max
from sentry_sdk.crons.decorator import monitor

from sentry import features
from sentry.models import (
    Activity,
    Group,
    GroupHistoryStatus,
    GroupStatus,
    ObjectStatus,
    Organization,
    OrganizationStatus,
    Project,
    record_group_history_from_activity_type,
    remove_group_from_inbox,
)
from sentry.tasks.base import instrumented_task, retry
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

ITERATOR_CHUNK = 10_000


@instrumented_task(
    name="sentry.tasks.auto_archive_issues.run_auto_archive",
    queue="auto_transition_issue_states",
    max_retries=3,
)  # type: ignore
@retry
@monitor(monitor_slug="auto-archive-job-monitor")
def run_auto_archive() -> None:
    """
    Automatically transition issues that are ongoing for 14 days to archived until escalating.
    """
    logger.info("Starting task for sentry.tasks.auto_archive_issues.run_auto_archive")

    for organization in RangeQuerySetWrapper(
        Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    ):
        if features.has("organizations:escalating-issues-v2", organization):
            project_ids = list(
                Project.objects.filter(
                    organization_id=organization.id, status=ObjectStatus.ACTIVE
                ).values_list("id", flat=True)
            )
            run_auto_archive_for_project.delay(project_ids=project_ids)


@instrumented_task(
    name="sentry.tasks.auto_archive_issues.run_auto_archive_for_projects",
    queue="auto_transition_issue_states",
    max_retries=3,
    default_retry_delay=60,
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
)  # type: ignore
@retry
def run_auto_archive_for_project(project_ids: List[int]) -> None:
    now = datetime.now(tz=pytz.UTC)
    fourteen_days_ago = now - timedelta(days=14)

    for ongoing_groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.ONGOING,
                project_id__in=project_ids,
                grouphistory__status=GroupHistoryStatus.ONGOING,
            )
            .annotate(recent_regressed_history=Max("grouphistory__date_added"))
            .filter(recent_regressed_history__lte=fourteen_days_ago),
            step=ITERATOR_CHUNK,
        ),
        ITERATOR_CHUNK,
    ):
        for group in ongoing_groups:
            updated = group.update(
                status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING
            )
            if updated:
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
