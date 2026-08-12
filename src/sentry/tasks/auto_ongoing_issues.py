import logging
import time
from datetime import datetime, timedelta, timezone

from django.db.models import Max, OuterRef, Subquery
from taskbroker_client.retry import Retry

from sentry import options
from sentry.issues.ongoing import TRANSITION_AFTER_DAYS, bulk_transition_group_to_ongoing
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.types.group import GroupSubStatus
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.tracing import set_span_tag, start_span

logger = logging.getLogger(__name__)

ITERATOR_CHUNK = 100
CHILD_TASK_COUNT = 250


def child_task_countdown(
    batch_index: int,
    spread_seconds: int,
    max_batches: int,
    elapsed_seconds: float,
) -> int:
    """
    Pure countdown math: land batch `batch_index` evenly across `spread_seconds`
    from schedule start. `elapsed_seconds` is time already spent paging so slow
    iterators don't double-delay later batches.
    """
    if spread_seconds <= 0 or max_batches <= 1 or batch_index <= 0:
        return 0
    capped_index = min(batch_index, max_batches - 1)
    target_offset = (capped_index * spread_seconds) // (max_batches - 1)
    return max(0, int(target_offset - elapsed_seconds))


def _schedule_limit() -> int:
    return ITERATOR_CHUNK * CHILD_TASK_COUNT


@instrumented_task(
    name="sentry.tasks.schedule_auto_transition_to_ongoing",
    namespace=issues_tasks,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.CELL,
)
def schedule_auto_transition_to_ongoing() -> None:
    """
    Triggered by cronjob (every few minutes). Spawns schedule subtasks that
    enqueue run_* child tasks spread over
    issues.auto_ongoing_issues.child_task_spread_seconds.
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
    silo_mode=SiloMode.CELL,
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

    spread_seconds = max(0, options.get("issues.auto_ongoing_issues.child_task_spread_seconds"))
    scheduled = 0
    with start_span(name="iterate_chunked_group_ids"):
        started = time.monotonic()
        for batch_index, groups in enumerate(
            chunked(
                RangeQuerySetWrapper(
                    base_queryset,
                    step=ITERATOR_CHUNK,
                    limit=_schedule_limit(),
                    order_by="first_seen",
                    override_unique_safety_check=True,
                ),
                ITERATOR_CHUNK,
            )
        ):
            scheduled += len(groups)
            run_auto_transition_issues_new_to_ongoing.apply_async(
                kwargs={"group_ids": [group.id for group in groups]},
                countdown=child_task_countdown(
                    batch_index,
                    spread_seconds,
                    CHILD_TASK_COUNT,
                    time.monotonic() - started,
                ),
            )

    metrics.incr(
        "sentry.tasks.schedule_auto_transition_issues_new_to_ongoing.executed",
        sample_rate=1.0,
        tags={"hit_limit": str(scheduled >= _schedule_limit()).lower()},
    )


@instrumented_task(
    name="sentry.tasks.run_auto_transition_issues_new_to_ongoing",
    namespace=issues_tasks,
    processing_deadline_duration=25 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.CELL,
)
def run_auto_transition_issues_new_to_ongoing(
    group_ids: list[int],
    **kwargs,
):
    """
    Child task of `auto_transition_issues_new_to_ongoing`
    to conduct the update of specified Groups to Ongoing.
    """
    with start_span(name="bulk_transition_group_to_ongoing") as span:
        set_span_tag(span, "group_ids", group_ids)
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
    silo_mode=SiloMode.CELL,
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
        .filter(recent_regressed_history__lte=date_threshold)
    )

    spread_seconds = max(0, options.get("issues.auto_ongoing_issues.child_task_spread_seconds"))
    scheduled = 0
    with start_span(name="iterate_chunked_group_ids"):
        started = time.monotonic()
        for batch_index, group_ids_with_regressed_history in enumerate(
            chunked(
                RangeQuerySetWrapper(
                    base_queryset.values_list("id", flat=True),
                    step=ITERATOR_CHUNK,
                    limit=_schedule_limit(),
                    result_value_getter=lambda item: item,
                ),
                ITERATOR_CHUNK,
            )
        ):
            scheduled += len(group_ids_with_regressed_history)
            run_auto_transition_issues_regressed_to_ongoing.apply_async(
                kwargs={"group_ids": group_ids_with_regressed_history},
                countdown=child_task_countdown(
                    batch_index,
                    spread_seconds,
                    CHILD_TASK_COUNT,
                    time.monotonic() - started,
                ),
            )

    metrics.incr(
        "sentry.tasks.schedule_auto_transition_issues_regressed_to_ongoing.executed",
        sample_rate=1.0,
        tags={"hit_limit": str(scheduled >= _schedule_limit()).lower()},
    )


@instrumented_task(
    name="sentry.tasks.run_auto_transition_issues_regressed_to_ongoing",
    namespace=issues_tasks,
    processing_deadline_duration=25 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.CELL,
)
def run_auto_transition_issues_regressed_to_ongoing(
    group_ids: list[int],
    **kwargs,
) -> None:
    """
    Child task of `auto_transition_issues_regressed_to_ongoing`
    to conduct the update of specified Groups to Ongoing.
    """
    with start_span(name="bulk_transition_group_to_ongoing") as span:
        set_span_tag(span, "group_ids", group_ids)
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
    silo_mode=SiloMode.CELL,
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
        .filter(recent_escalating_history__lte=date_threshold)
    )

    spread_seconds = max(0, options.get("issues.auto_ongoing_issues.child_task_spread_seconds"))
    scheduled = 0
    with start_span(name="iterate_chunked_group_ids"):
        started = time.monotonic()
        for batch_index, new_group_ids in enumerate(
            chunked(
                RangeQuerySetWrapper(
                    base_queryset.values_list("id", flat=True),
                    step=ITERATOR_CHUNK,
                    limit=_schedule_limit(),
                    result_value_getter=lambda item: item,
                ),
                ITERATOR_CHUNK,
            )
        ):
            scheduled += len(new_group_ids)
            run_auto_transition_issues_escalating_to_ongoing.apply_async(
                kwargs={"group_ids": new_group_ids},
                countdown=child_task_countdown(
                    batch_index,
                    spread_seconds,
                    CHILD_TASK_COUNT,
                    time.monotonic() - started,
                ),
            )

    metrics.incr(
        "sentry.tasks.schedule_auto_transition_issues_escalating_to_ongoing.executed",
        sample_rate=1.0,
        tags={"hit_limit": str(scheduled >= _schedule_limit()).lower()},
    )


@instrumented_task(
    name="sentry.tasks.run_auto_transition_issues_escalating_to_ongoing",
    namespace=issues_tasks,
    processing_deadline_duration=25 * 60,
    retry=Retry(times=3, delay=60),
    silo_mode=SiloMode.CELL,
)
def run_auto_transition_issues_escalating_to_ongoing(
    group_ids: list[int],
    **kwargs,
) -> None:
    """
    Child task of `auto_transition_issues_escalating_to_ongoing`
    to conduct the update of specified Groups to Ongoing.
    """
    with start_span(name="bulk_transition_group_to_ongoing") as span:
        set_span_tag(span, "group_ids", group_ids)
        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.ESCALATING,
            group_ids,
            activity_data={"after_days": TRANSITION_AFTER_DAYS},
        )
