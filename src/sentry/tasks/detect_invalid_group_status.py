from collections import defaultdict
from datetime import timedelta
from logging import getLogger

from django.utils import timezone

from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.types.group import SUBSTATUS_TO_STR, UNRESOLVED_SUBSTATUS_CHOICES, GroupSubStatus

logger = getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.detect_invalid_group_status",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def detect_invalid_group_status(organization_id: int):
    # Find all unresolved groups for the organization
    three_days_ago = timezone.now() - timedelta(days=3)
    seven_days_ago = timezone.now() - timedelta(days=7)
    groups = Group.objects.filter(
        status=GroupStatus.UNRESOLVED,
        project__organization_id=organization_id,
    ).exclude(substatus=GroupSubStatus.ONGOING)
    invalid_groups = defaultdict(list)

    # Iterate over all unresolved groups and check if they have the correct substatus
    for group in groups:
        if group.substatus == GroupSubStatus.NEW and group.first_seen < three_days_ago:
            invalid_groups[group.substatus].append(group.id)
        elif group.substatus == GroupSubStatus.REGRESSED:
            group_history = (
                GroupHistory.objects.filter(
                    group=group,
                    status=GroupHistoryStatus.REGRESSED,
                )
                .order_by("-date_added")
                .first()
            )

            if not group_history or group_history.date_added < seven_days_ago:
                invalid_groups[group.substatus].append(group.id)
        elif group.substatus == GroupSubStatus.ESCALATING:
            group_history = (
                GroupHistory.objects.filter(
                    group=group,
                    status=GroupHistoryStatus.ESCALATING,
                )
                .order_by("-date_added")
                .first()
            )

            if not group_history or group_history.date_added < seven_days_ago:
                invalid_groups[group.substatus].append(group.id)
        elif group.substatus not in UNRESOLVED_SUBSTATUS_CHOICES:
            invalid_groups[group.substatus].append(group.id)

    error_extra = {SUBSTATUS_TO_STR[k]: v for k, v in invalid_groups.items()}
    if len(invalid_groups) > 0:
        logger.error(
            "Found groups with incorrect substatus",
            extra={
                "organization_id": organization_id,
                "count": sum(len(v) for v in invalid_groups.values()),
                **error_extra,
            },
        )
