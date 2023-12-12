import logging
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import List

import sentry_sdk
from django.db.models import Max

from sentry.conf.server import CELERY_ISSUE_STATES_QUEUE
from sentry.issues.ongoing import bulk_transition_group_to_ongoing
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus
from sentry.monitoring.queues import backend
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.types.group import GroupSubStatus
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

TRANSITION_AFTER_DAYS = 7
ITERATOR_CHUNK = 100
CHILD_TASK_COUNT = 250


def log_error_if_queue_has_items(func):
    """
    Prevent adding more tasks in queue if the queue is not empty.
    We want to prevent crons from scheduling more tasks than the workers
    are capable of processing before the next cycle.
    """

    def inner(func):
        @wraps(func)
        def wrapped(*args, **kwargs):
            assert backend is not None, "queues monitoring is not enabled"
            queue_size = backend.get_size(CELERY_ISSUE_STATES_QUEUE.name)
            if queue_size > 0:
                logger.info(
                    "%s queue size greater than 0.",
                    CELERY_ISSUE_STATES_QUEUE.name,
                    extra={"size": queue_size, "task": func.__name__},
                )

            func(*args, **kwargs)

        return wrapped

    return inner(func)


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_to_ongoing",
    queue="auto_transition_issue_states",
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@log_error_if_queue_has_items
def schedule_auto_transition_to_ongoing() -> None:
    """
    Triggered by cronjob every minute. This task will spawn subtasks
    that transition Issues to Ongoing according to their specific
    criteria.
    """
    with sentry_sdk.start_transaction(op="task", name="schedule_auto_transition_to_ongoing"):
        now = datetime.now(tz=timezone.utc)

        seven_days_ago = now - timedelta(days=TRANSITION_AFTER_DAYS)

        schedule_auto_transition_issues_new_to_ongoing.delay(
            first_seen_lte=int(seven_days_ago.timestamp()),
            expires=now + timedelta(hours=1),
        )

        schedule_auto_transition_issues_regressed_to_ongoing.delay(
            date_added_lte=int(seven_days_ago.timestamp()),
            expires=now + timedelta(hours=1),
        )

        schedule_auto_transition_issues_escalating_to_ongoing.delay(
            date_added_lte=int(seven_days_ago.timestamp()),
            expires=now + timedelta(hours=1),
        )


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_issues_new_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@log_error_if_queue_has_items
def schedule_auto_transition_issues_new_to_ongoing(
    first_seen_lte: int,
    **kwargs,
) -> None:
    """
    We will update NEW Groups to ONGOING that were created before the
    most recent Group first seen 7 days ago. This task will trigger upto
    50 subtasks to complete the update. We don't expect all eligible Groups
    to be updated in a single run. However, we expect every instantiation of this task
    to chip away at the backlog of Groups and eventually update all the eligible groups.
    """
    total_count = 0

    def get_total_count(results):
        nonlocal total_count
        total_count += len(results)

    first_seen_lte_datetime = datetime.fromtimestamp(first_seen_lte, timezone.utc)
    base_queryset = Group.objects.filter(
        status=GroupStatus.UNRESOLVED,
        substatus=GroupSubStatus.NEW,
        first_seen__lte=first_seen_lte_datetime,
    )

    logger_extra = {
        "first_seen_lte": first_seen_lte,
        "first_seen_lte_datetime": first_seen_lte_datetime,
    }
    if base_queryset:
        logger_extra["issue_first_seen"] = base_queryset[0].first_seen
    logger.info(
        "auto_transition_issues_new_to_ongoing started",
        extra=logger_extra,
    )

    with sentry_sdk.start_span(description="iterate_chunked_group_ids"):
        for groups in chunked(
            RangeQuerySetWrapper(
                base_queryset._clone(),
                step=ITERATOR_CHUNK,
                limit=ITERATOR_CHUNK * CHILD_TASK_COUNT,
                callbacks=[get_total_count],
                order_by="first_seen",
            ),
            ITERATOR_CHUNK,
        ):
            run_auto_transition_issues_new_to_ongoing.delay(
                group_ids=[group.id for group in groups],
            )

    metrics.incr(
        "sentry.tasks.schedule_auto_transition_issues_new_to_ongoing.executed",
        sample_rate=1.0,
        tags={"count": total_count},
    )


@instrumented_task(
    name="sentry.tasks.run_auto_transition_issues_new_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def run_auto_transition_issues_new_to_ongoing(
    group_ids: List[int],
    **kwargs,
):
    """
    Child task of `auto_transition_issues_new_to_ongoing`
    to conduct the update of specified Groups to Ongoing.
    """
    with sentry_sdk.start_span(description="bulk_transition_group_to_ongoing") as span:
        span.set_tag("group_ids", group_ids)
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.NEW,
            group_ids,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_issues_regressed_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@log_error_if_queue_has_items
def schedule_auto_transition_issues_regressed_to_ongoing(
    date_added_lte: int,
    **kwargs,
) -> None:
    """
    We will update REGRESSED Groups to ONGOING that were created before the
    most recent Group first seen 7 days ago. This task will trigger upto
    50 subtasks to complete the update. We don't expect all eligible Groups
    to be updated in a single run. However, we expect every instantiation of this task
    to chip away at the backlog of Groups and eventually update all the eligible groups.
    """
    total_count = 0

    def get_total_count(results):
        nonlocal total_count
        total_count += len(results)

    base_queryset = (
        Group.objects.filter(
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.REGRESSED,
            grouphistory__status=GroupHistoryStatus.REGRESSED,
        )
        .annotate(recent_regressed_history=Max("grouphistory__date_added"))
        .filter(recent_regressed_history__lte=datetime.fromtimestamp(date_added_lte, timezone.utc))
    )

    with sentry_sdk.start_span(description="iterate_chunked_group_ids"):
        for group_ids_with_regressed_history in chunked(
            RangeQuerySetWrapper(
                base_queryset._clone().values_list("id", flat=True),
                step=ITERATOR_CHUNK,
                limit=ITERATOR_CHUNK * CHILD_TASK_COUNT,
                result_value_getter=lambda item: item,
                callbacks=[get_total_count],
            ),
            ITERATOR_CHUNK,
        ):
            run_auto_transition_issues_regressed_to_ongoing.delay(
                group_ids=group_ids_with_regressed_history,
            )

    metrics.incr(
        "sentry.tasks.schedule_auto_transition_issues_regressed_to_ongoing.executed",
        sample_rate=1.0,
        tags={"count": total_count},
    )


@instrumented_task(
    name="sentry.tasks.run_auto_transition_issues_regressed_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def run_auto_transition_issues_regressed_to_ongoing(
    group_ids: List[int],
    **kwargs,
) -> None:
    """
    Child task of `auto_transition_issues_regressed_to_ongoing`
    to conduct the update of specified Groups to Ongoing.
    """
    with sentry_sdk.start_span(description="bulk_transition_group_to_ongoing") as span:
        span.set_tag("group_ids", group_ids)
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.REGRESSED,
            group_ids,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_issues_escalating_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@log_error_if_queue_has_items
def schedule_auto_transition_issues_escalating_to_ongoing(
    date_added_lte: int,
    **kwargs,
) -> None:
    """
    We will update ESCALATING Groups to ONGOING that were created before the
    most recent Group first seen 7 days ago. This task will trigger upto
    50 subtasks to complete the update. We don't expect all eligible Groups
    to be updated in a single run. However, we expect every instantiation of this task
    to chip away at the backlog of Groups and eventually update all the eligible groups.
    """
    total_count = 0

    def get_total_count(results):
        nonlocal total_count
        total_count += len(results)

    base_queryset = (
        Group.objects.filter(
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
            grouphistory__status=GroupHistoryStatus.ESCALATING,
        )
        .annotate(recent_escalating_history=Max("grouphistory__date_added"))
        .filter(recent_escalating_history__lte=datetime.fromtimestamp(date_added_lte, timezone.utc))
    )

    with sentry_sdk.start_span(description="iterate_chunked_group_ids"):
        for new_group_ids in chunked(
            RangeQuerySetWrapper(
                base_queryset._clone().values_list("id", flat=True),
                step=ITERATOR_CHUNK,
                limit=ITERATOR_CHUNK * CHILD_TASK_COUNT,
                result_value_getter=lambda item: item,
                callbacks=[get_total_count],
            ),
            ITERATOR_CHUNK,
        ):
            run_auto_transition_issues_escalating_to_ongoing.delay(
                group_ids=new_group_ids,
            )

    metrics.incr(
        "sentry.tasks.schedule_auto_transition_issues_escalating_to_ongoing.executed",
        sample_rate=1.0,
        tags={"count": total_count},
    )


@instrumented_task(
    name="sentry.tasks.run_auto_transition_issues_escalating_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def run_auto_transition_issues_escalating_to_ongoing(
    group_ids: List[int],
    **kwargs,
) -> None:
    """
    Child task of `auto_transition_issues_escalating_to_ongoing`
    to conduct the update of specified Groups to Ongoing.
    """
    with sentry_sdk.start_span(description="bulk_transition_group_to_ongoing") as span:
        span.set_tag("group_ids", group_ids)
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.ESCALATING,
            group_ids,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )
