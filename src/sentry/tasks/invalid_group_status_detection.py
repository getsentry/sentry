import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from logging import getLogger

from django.db import connection

from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus
from sentry.silo import SiloMode
from sentry.tasks.auto_ongoing_issues import TRANSITION_AFTER_DAYS
from sentry.tasks.base import instrumented_task
from sentry.types.group import SUBSTATUS_TO_STR, UNRESOLVED_SUBSTATUS_CHOICES, GroupSubStatus
from sentry.utils.query import RangeQuerySetWrapper

logger = getLogger(__name__)

SAMPLE_SIZE = 500
SEVEN_DAYS_AGO = datetime.now(tz=timezone.utc) - timedelta(days=TRANSITION_AFTER_DAYS)
QUERY = """SELECT group_id, MAX(date_added)
    FROM sentry_grouphistory
    WHERE group_id IN ({group_ids}) and status = {status}
    GROUP BY group_id
"""


@instrumented_task(
    name="sentry.tasks.issues.invalid_group_status_detection",
    queue="invalid_group_status_detection",
    time_limit=5 * 60,  # 5 minutes
    max_retries=3,
    default_retry_delay=60,
    silo_mode=SiloMode.REGION,
)
def detect_invalid_group_status() -> None:
    group_ids = list(Group.objects.values_list("id", flat=True))
    random_group_ids = random.sample(group_ids, SAMPLE_SIZE)
    invalid_groups = defaultdict(list)
    regressed_groups = []
    escalating_groups = []
    for group in RangeQuerySetWrapper(
        Group.objects.filter(id__in=random_group_ids, status=GroupStatus.UNRESOLVED)
    ):
        if group.substatus not in UNRESOLVED_SUBSTATUS_CHOICES:
            invalid_groups[group.substatus].append(group.id)

        if group.substatus == GroupSubStatus.NEW:
            if group.first_seen < SEVEN_DAYS_AGO:
                invalid_groups[group.substatus].append(group.id)

        if group.substatus == GroupSubStatus.REGRESSED:
            regressed_groups.append(str(group.id))
        elif group.substatus == GroupSubStatus.ESCALATING:
            escalating_groups.append(str(group.id))

    cursor = connection.cursor()
    if len(escalating_groups) > 0:
        cursor.execute(
            QUERY.format(
                group_ids=(",".join(escalating_groups)), status=GroupHistoryStatus.ESCALATING
            ),
        )

        for group_id, status_date in cursor.fetchall():
            if status_date < SEVEN_DAYS_AGO:
                invalid_groups[GroupSubStatus.ESCALATING].append(group_id)

    if len(regressed_groups) > 0:
        cursor.execute(
            QUERY.format(
                group_ids=(",".join(regressed_groups)), status=GroupHistoryStatus.REGRESSED
            ),
        )

        for group_id, status_date in cursor.fetchall():
            if status_date < SEVEN_DAYS_AGO:
                invalid_groups[GroupSubStatus.REGRESSED].append(group_id)

    error_extra = {SUBSTATUS_TO_STR[k]: v for k, v in invalid_groups.items()}
    if len(invalid_groups) > 0:
        logger.error(
            "Found groups with incorrect substatus",
            extra={
                "count": sum(len(v) for v in invalid_groups.values()),
                **error_extra,
            },
        )
