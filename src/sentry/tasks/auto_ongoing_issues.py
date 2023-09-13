import logging
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import List, Optional

from django.db import OperationalError
from django.db.models import Max
from sentry_sdk.crons.decorator import monitor

from sentry.conf.server import CELERY_ISSUE_STATES_QUEUE
from sentry.issues.ongoing import bulk_transition_group_to_ongoing
from sentry.models import Group, GroupHistoryStatus, GroupStatus
from sentry.monitoring.queues import backend
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.types.group import GroupSubStatus
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

TRANSITION_AFTER_DAYS = 7
ITERATOR_CHUNK = 10_000


def log_error_if_queue_has_items(func):
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
                logger.info(
                    f"{CELERY_ISSUE_STATES_QUEUE.name} queue size greater than 0.",
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
@retry(on=(OperationalError,))
@monitor(monitor_slug="schedule_auto_transition_to_ongoing")
@log_error_if_queue_has_items
def schedule_auto_transition_to_ongoing() -> None:
    now = datetime.now(tz=timezone.utc)

    seven_days_ago = now - timedelta(days=TRANSITION_AFTER_DAYS)

    auto_transition_issues_new_to_ongoing.delay(
        project_ids=[],  # TODO remove arg in next PR
        first_seen_lte=int(seven_days_ago.timestamp()),
        organization_id=None,  # TODO remove arg in next PR
        expires=now + timedelta(hours=1),
    )

    auto_transition_issues_regressed_to_ongoing.delay(
        project_ids=[],  # TODO(nisanthan): Remove this arg in next PR
        date_added_lte=int(seven_days_ago.timestamp()),
        expires=now + timedelta(hours=1),
    )

    auto_transition_issues_escalating_to_ongoing.delay(
        project_ids=[],  # TODO(nisanthan): Remove this arg in next PR
        date_added_lte=int(seven_days_ago.timestamp()),
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
    silo_mode=SiloMode.REGION,
)
@retry(on=(OperationalError,))
@log_error_if_queue_has_items
def auto_transition_issues_new_to_ongoing(
    project_ids: List[int],  # TODO remove arg in next PR
    first_seen_lte: int,
    organization_id: int,  # TODO remove arg in next PR
    **kwargs,
) -> None:
    """
    We will update all NEW Groups to ONGOING that were created before the
    most recent Group first seen 7 days ago.
    """

    most_recent_group_first_seen_seven_days_ago = (
        Group.objects.filter(
            first_seen__lte=datetime.fromtimestamp(first_seen_lte, timezone.utc),
        )
        .order_by("-id")
        .first()
    )
    logger.info(
        "auto_transition_issues_new_to_ongoing started",
        extra={
            "most_recent_group_first_seen_seven_days_ago": most_recent_group_first_seen_seven_days_ago.id,
            "first_seen_lte": first_seen_lte,
        },
    )

    for new_groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.NEW,
                id__lte=1,
            ),
            step=ITERATOR_CHUNK,
            limit=ITERATOR_CHUNK * 50,
        ),
        ITERATOR_CHUNK,
    ):
        for group in new_groups:
            logger.info(
                "auto_transition_issues_new_to_ongoing updating group",
                extra={
                    "most_recent_group_first_seen_seven_days_ago": most_recent_group_first_seen_seven_days_ago.id,
                    "group_id": group.id,
                },
            )
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.NEW,
            new_groups,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_regressed_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@retry(on=(OperationalError,))
@log_error_if_queue_has_items
def auto_transition_issues_regressed_to_ongoing(
    project_ids: List[int],  # TODO(nisanthan): Remove this arg in next PR
    date_added_lte: int,
    project_id: Optional[int] = None,  # TODO(nisanthan): Remove this arg in next PR
    **kwargs,
) -> None:

    for groups_with_regressed_history in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.REGRESSED,
                grouphistory__status=GroupHistoryStatus.REGRESSED,
            )
            .annotate(recent_regressed_history=Max("grouphistory__date_added"))
            .filter(
                recent_regressed_history__lte=datetime.fromtimestamp(date_added_lte, timezone.utc)
            ),
            step=ITERATOR_CHUNK,
            limit=ITERATOR_CHUNK * 50,
        ),
        ITERATOR_CHUNK,
    ):

        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.REGRESSED,
            groups_with_regressed_history,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )


@instrumented_task(
    name="sentry.tasks.auto_transition_issues_escalating_to_ongoing",
    queue="auto_transition_issue_states",
    time_limit=25 * 60,
    soft_time_limit=20 * 60,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@retry(on=(OperationalError,))
@log_error_if_queue_has_items
def auto_transition_issues_escalating_to_ongoing(
    project_ids: List[int],  # TODO(nisanthan): Remove this arg in next PR
    date_added_lte: int,
    project_id: Optional[int] = None,  # TODO(nisanthan): Remove this arg in next PR
    **kwargs,
) -> None:

    for new_groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.ESCALATING,
                grouphistory__status=GroupHistoryStatus.ESCALATING,
            )
            .annotate(recent_escalating_history=Max("grouphistory__date_added"))
            .filter(
                recent_escalating_history__lte=datetime.fromtimestamp(date_added_lte, timezone.utc)
            ),
            step=ITERATOR_CHUNK,
            limit=ITERATOR_CHUNK * 50,
        ),
        ITERATOR_CHUNK,
    ):
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.ESCALATING,
            new_groups,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )
