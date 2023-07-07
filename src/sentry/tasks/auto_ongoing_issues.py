import logging
from datetime import datetime, timedelta
from functools import wraps
from typing import Optional

import pytz
from django.db import OperationalError
from django.db.models import Max
from sentry_sdk.crons.decorator import monitor

from sentry import features
from sentry.conf.server import CELERY_ISSUE_STATES_QUEUE
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
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

TRANSITION_AFTER_DAYS = 7


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
    three_days_past = now - timedelta(days=TRANSITION_AFTER_DAYS)

    for org in RangeQuerySetWrapper(Organization.objects.filter(status=OrganizationStatus.ACTIVE)):
        if features.has("organizations:escalating-issues", org):
            for project_id in Project.objects.filter(organization_id=org.id).values_list(
                "id", flat=True
            ):
                auto_transition_issues_new_to_ongoing.delay(
                    project_id=project_id,
                    first_seen_lte=int(three_days_past.timestamp()),
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
    project_id: int,
    first_seen_lte: int,
    first_seen_gte: Optional[int] = None,
    chunk_size: int = 1000,
    **kwargs,
) -> None:
    queryset = Group.objects.filter(
        project_id=project_id,
        status=GroupStatus.UNRESOLVED,
        substatus=GroupSubStatus.NEW,
        first_seen__lte=datetime.fromtimestamp(first_seen_lte, pytz.UTC),
    )

    if first_seen_gte:
        queryset = queryset.filter(first_seen__gte=datetime.fromtimestamp(first_seen_gte, pytz.UTC))

    new_groups = list(queryset.order_by("first_seen")[:chunk_size])

    bulk_transition_group_to_ongoing(
        GroupStatus.UNRESOLVED,
        GroupSubStatus.NEW,
        new_groups,
        activity_data={"after_days": TRANSITION_AFTER_DAYS},
    )

    if len(new_groups) == chunk_size:
        auto_transition_issues_new_to_ongoing.delay(
            project_id=project_id,
            first_seen_lte=first_seen_lte,
            first_seen_gte=new_groups[chunk_size - 1].first_seen.timestamp(),
            chunk_size=chunk_size,
            expires=datetime.now(tz=pytz.UTC) + timedelta(hours=1),
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
    three_days_past = now - timedelta(days=TRANSITION_AFTER_DAYS)

    for org in RangeQuerySetWrapper(Organization.objects.filter(status=OrganizationStatus.ACTIVE)):
        if features.has("organizations:escalating-issues", org):
            for project_id in Project.objects.filter(organization_id=org.id).values_list(
                "id", flat=True
            ):
                auto_transition_issues_regressed_to_ongoing.delay(
                    project_id=project_id,
                    date_added_lte=int(three_days_past.timestamp()),
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
    project_id: int,
    date_added_lte: int,
    date_added_gte: Optional[int] = None,
    chunk_size: int = 1000,
    **kwargs,
) -> None:
    queryset = (
        Group.objects.filter(
            project_id=project_id,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.REGRESSED,
            grouphistory__status=GroupHistoryStatus.REGRESSED,
        )
        .annotate(recent_regressed_history=Max("grouphistory__date_added"))
        .filter(recent_regressed_history__lte=datetime.fromtimestamp(date_added_lte, pytz.UTC))
    )

    if date_added_gte:
        queryset = queryset.filter(
            recent_regressed_history__gte=datetime.fromtimestamp(date_added_gte, pytz.UTC)
        )

    groups_with_regressed_history = list(queryset.order_by("recent_regressed_history")[:chunk_size])

    bulk_transition_group_to_ongoing(
        GroupStatus.UNRESOLVED,
        GroupSubStatus.REGRESSED,
        groups_with_regressed_history,
        activity_data={"after_days": TRANSITION_AFTER_DAYS},
    )

    if len(groups_with_regressed_history) == chunk_size:
        auto_transition_issues_regressed_to_ongoing.delay(
            project_id=project_id,
            date_added_lte=date_added_lte,
            date_added_gte=groups_with_regressed_history[
                chunk_size - 1
            ].recent_regressed_history.timestamp(),
            chunk_size=chunk_size,
            expires=datetime.now(tz=pytz.UTC) + timedelta(hours=1),
        )
