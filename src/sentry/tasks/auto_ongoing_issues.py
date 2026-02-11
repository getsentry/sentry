import logging
from datetime import datetime, timedelta, timezone

import sentry_sdk
from django.db.models import Max, OuterRef, Subquery

from sentry.issues.ongoing import TRANSITION_AFTER_DAYS, bulk_transition_group_to_ongoing
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.retry import Retry
from sentry.types.group import GroupSubStatus
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

ITERATOR_CHUNK = 100
CHILD_TASK_COUNT = 250


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_to_ongoing",
    namespace=issues_tasks,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.REGION,
)
def schedule_auto_transition_to_ongoing() -> None:
    """
    Triggered by cronjob every minute. This task will spawn subtasks
    that transition Issues to Ongoing according to their specific
    criteria.
    """
    now = datetime.now(tz=timezone.utc)

    seven_days_ago = now - timedelta(days=TRANSITION_AFTER_DAYS)

    schedule_auto_transition_issues_new_to_ongoing.delay(
        first_seen_lte=int(seven_days_ago.timestamp()),
    )

    schedule_auto_transition_issues_regressed_to_ongoing.delay(
        date_added_lte=int(seven_days_ago.timestamp()),
    )

    schedule_auto_transition_issues_escalating_to_ongoing.delay(
        date_added_lte=int(seven_days_ago.timestamp()),
    )


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_issues_new_to_ongoing",
    namespace=issues_tasks,
    processing_deadline_duration=25 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.REGION,
)
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
    logger.info(
        "auto_transition_issues_new_to_ongoing started",
        extra=logger_extra,
    )

    with sentry_sdk.start_span(name="iterate_chunked_group_ids"):
        for groups in chunked(
            RangeQuerySetWrapper(
                base_queryset,
                step=ITERATOR_CHUNK,
                limit=ITERATOR_CHUNK * CHILD_TASK_COUNT,
                callbacks=[get_total_count],
                order_by="first_seen",
                override_unique_safety_check=True,
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
    namespace=issues_tasks,
    processing_deadline_duration=25 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.REGION,
)
def run_auto_transition_issues_new_to_ongoing(
    group_ids: list[int],
    **kwargs,
):
    """
    Child task of `auto_transition_issues_new_to_ongoing`
    to conduct the update of specified Groups to Ongoing.
    """
    with sentry_sdk.start_span(name="bulk_transition_group_to_ongoing") as span:
        span.set_tag("group_ids", group_ids)
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.NEW,
            group_ids,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_issues_regressed_to_ongoing",
    namespace=issues_tasks,
    processing_deadline_duration=25 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.REGION,
)
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

    date_threshold = datetime.fromtimestamp(date_added_lte, timezone.utc)

    # Use a subquery to get the most recent REGRESSED history date for each group.
    # This ensures we only transition groups whose MOST RECENT regressed history
    # is older than the threshold, not just any regressed history.
    latest_regressed_subquery = (
        GroupHistory.objects.filter(group_id=OuterRef("id"), status=GroupHistoryStatus.REGRESSED)
        .values("group_id")
        .annotate(max_date=Max("date_added"))
        .values("max_date")[:1]
    )

    base_queryset = (
        Group.objects.filter(
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.REGRESSED,
        )
        .annotate(recent_regressed_history=Subquery(latest_regressed_subquery))
        .filter(
            recent_regressed_history__lte=date_threshold,
            recent_regressed_history__isnull=False,
        )
    )

    with sentry_sdk.start_span(name="iterate_chunked_group_ids"):
        for group_ids_with_regressed_history in chunked(
            RangeQuerySetWrapper(
                base_queryset.values_list("id", flat=True),
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
    namespace=issues_tasks,
    processing_deadline_duration=25 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.REGION,
)
def run_auto_transition_issues_regressed_to_ongoing(
    group_ids: list[int],
    **kwargs,
) -> None:
    """
    Child task of `auto_transition_issues_regressed_to_ongoing`
    to conduct the update of specified Groups to Ongoing.
    """
    with sentry_sdk.start_span(name="bulk_transition_group_to_ongoing") as span:
        span.set_tag("group_ids", group_ids)
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.REGRESSED,
            group_ids,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_issues_escalating_to_ongoing",
    namespace=issues_tasks,
    processing_deadline_duration=25 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.REGION,
)
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

    from django.db.models import Max, OuterRef, Subquery

    date_threshold = datetime.fromtimestamp(date_added_lte, timezone.utc)

    # Use a subquery to get the most recent ESCALATING history date for each group.
    # This ensures we only transition groups whose MOST RECENT escalating history
    # is older than the threshold, not just any escalating history.
    latest_escalating_subquery = (
        GroupHistory.objects.filter(group_id=OuterRef("id"), status=GroupHistoryStatus.ESCALATING)
        .values("group_id")
        .annotate(max_date=Max("date_added"))
        .values("max_date")[:1]
    )

    base_queryset = (
        Group.objects.filter(
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
        )
        .annotate(recent_escalating_history=Subquery(latest_escalating_subquery))
        .filter(
            recent_escalating_history__lte=date_threshold,
            recent_escalating_history__isnull=False,
        )
    )

    with sentry_sdk.start_span(name="iterate_chunked_group_ids"):
        for new_group_ids in chunked(
            RangeQuerySetWrapper(
                base_queryset.values_list("id", flat=True),
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
    namespace=issues_tasks,
    processing_deadline_duration=25 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.REGION,
)
def run_auto_transition_issues_escalating_to_ongoing(
    group_ids: list[int],
    **kwargs,
) -> None:
    """
    Child task of `auto_transition_issues_escalating_to_ongoing`
    to conduct the update of specified Groups to Ongoing.
    """
    with sentry_sdk.start_span(name="bulk_transition_group_to_ongoing") as span:
        span.set_tag("group_ids", group_ids)
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.ESCALATING,
            group_ids,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )
