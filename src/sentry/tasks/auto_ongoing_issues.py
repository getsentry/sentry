import logging
from datetime import datetime, timedelta
from functools import wraps
from typing import List, Optional

import pytz
from django.db import OperationalError
from django.db.models import Max
from sentry_sdk.crons.decorator import monitor

from sentry import features
from sentry.conf.server import CELERY_ISSUE_STATES_QUEUE
from sentry.constants import ObjectStatus
from sentry.issues.ongoing import bulk_transition_group_to_ongoing
from sentry.models import (
    Group,
    GroupHistoryStatus,
    GroupStatus,
    Organization,
    OrganizationStatus,
    Project,
)
from sentry.monitoring.queues import backend
from sentry.tasks.base import instrumented_task, retry
from sentry.types.group import GroupSubStatus
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

TRANSITION_AFTER_DAYS = 7
ITERATOR_CHUNK = 10_000


def skip_if_queue_has_items(func):
    """
    Prevent adding more tasks in queue if the queue is not empty.
    We want to prevent crons from scheduling more tasks than the workers
    are capable of processing before the next cycle.
    """

    def inner(func):
        @wraps(func)
        def wrapped(*args, **kwargs):
            queue_size = backend.get_size(CELERY_ISSUE_STATES_QUEUE.name)
            if queue_size > 0:
                logger.exception(
                    f"{CELERY_ISSUE_STATES_QUEUE.name} queue size greater than 0.",
                    extra={"size": queue_size, "task": func.__name__},
                )
                return

            func(*args, **kwargs)

        return wrapped

    return inner(func)


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_new",
    queue="auto_transition_issue_states",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
@retry(on=(OperationalError,))
@monitor(monitor_slug="schedule_auto_transition_new")
@skip_if_queue_has_items
def schedule_auto_transition_new() -> None:

    now = datetime.now(tz=pytz.UTC)
    seven_days_ago = now - timedelta(days=TRANSITION_AFTER_DAYS)

    for org in RangeQuerySetWrapper(Organization.objects.filter(status=OrganizationStatus.ACTIVE)):
        if features.has("organizations:escalating-issues", org):
            project_ids = list(
                Project.objects.filter(
                    organization_id=org.id, status=ObjectStatus.ACTIVE
                ).values_list("id", flat=True)
            )

            auto_transition_issues_new_to_ongoing.delay(
                project_ids=project_ids,
                first_seen_lte=int(seven_days_ago.timestamp()),
                expires=now + timedelta(hours=1),
            )


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_new_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
@retry(on=(OperationalError,))
@skip_if_queue_has_items
def auto_transition_issues_new_to_ongoing(
    project_ids: List[int],
    first_seen_lte: int,
    project_id: Optional[int] = None,  # TODO(nisanthan): Remove this arg in next PR
    **kwargs,
) -> None:
    # TODO(nisanthan): Remove this conditional in next PR
    if project_id is not None:
        project_ids = [project_id]

    for new_groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                project_id__in=project_ids,
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.NEW,
                first_seen__lte=datetime.fromtimestamp(first_seen_lte, pytz.UTC),
            ),
            step=ITERATOR_CHUNK,
        ),
        ITERATOR_CHUNK,
    ):
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.NEW,
            new_groups,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_regressed",
    queue="auto_transition_issue_states",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
@retry(on=(OperationalError,))
@monitor(monitor_slug="schedule_auto_transition_regressed")
@skip_if_queue_has_items
def schedule_auto_transition_regressed() -> None:

    now = datetime.now(tz=pytz.UTC)
    seven_days_ago = now - timedelta(days=TRANSITION_AFTER_DAYS)

    for org in RangeQuerySetWrapper(Organization.objects.filter(status=OrganizationStatus.ACTIVE)):
        if features.has("organizations:escalating-issues", org):
            project_ids = list(
                Project.objects.filter(
                    organization_id=org.id, status=ObjectStatus.ACTIVE
                ).values_list("id", flat=True)
            )

            auto_transition_issues_regressed_to_ongoing.delay(
                project_ids=project_ids,
                date_added_lte=int(seven_days_ago.timestamp()),
                expires=now + timedelta(hours=1),
            )


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_regressed_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
)
@retry(on=(OperationalError,))
@skip_if_queue_has_items
def auto_transition_issues_regressed_to_ongoing(
    project_ids: List[int],
    date_added_lte: int,
    project_id: Optional[int] = None,  # TODO(nisanthan): Remove this arg in next PR
    **kwargs,
) -> None:

    # TODO(nisanthan): Remove this conditional in next PR
    if project_id is not None:
        project_ids = [project_id]

    for groups_with_regressed_history in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                project_id__in=project_ids,
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.REGRESSED,
                grouphistory__status=GroupHistoryStatus.REGRESSED,
            )
            .annotate(recent_regressed_history=Max("grouphistory__date_added"))
            .filter(recent_regressed_history__lte=datetime.fromtimestamp(date_added_lte, pytz.UTC)),
            step=ITERATOR_CHUNK,
        ),
        ITERATOR_CHUNK,
    ):

        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.REGRESSED,
            groups_with_regressed_history,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )
