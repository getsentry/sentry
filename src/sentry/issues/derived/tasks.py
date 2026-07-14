import logging
from datetime import UTC, datetime, timedelta

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks

logger = logging.getLogger(__name__)

BATCH_PROCESSING_DEADLINE = timedelta(seconds=30)
BATCH_RETRIGGER_DEADLINE = timedelta(seconds=20)


@instrumented_task(
    name="sentry.issues.derived.tasks.process_group_log_task",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def process_group_log_task(group_id: int, **kwargs: object) -> None:
    from sentry.issues.derived.processing import process_group_log
    from sentry.models.group import Group

    try:
        process_group_log(group_id)
    except Group.DoesNotExist:
        logger.info("process_group_log_task.group_not_found", extra={"group_id": group_id})


@instrumented_task(
    name="sentry.issues.derived.tasks.process_project_derived_data",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
)
def process_project_derived_data(project_id: int, **kwargs: object) -> None:
    from django.db.models import Exists, OuterRef

    from sentry import options
    from sentry.issues.models.groupderiveddata import GroupDerivedData
    from sentry.models.group import Group

    batch_size = options.get("issues.derived.project-batch-size")
    max_tasks = options.get("issues.derived.project-max-tasks")

    group_ids = list(
        Group.objects.filter(project_id=project_id)
        .exclude(Exists(GroupDerivedData.objects.filter(group_id=OuterRef("id"))))
        .order_by("id")
        .values_list("id", flat=True)
    )

    if not group_ids:
        return

    starts = [group_ids[i] for i in range(0, len(group_ids), batch_size)]
    ends = starts[1:] + [group_ids[-1] + 1]
    ranges = list(zip(starts, ends))

    if len(ranges) > max_tasks:
        logger.error(
            "process_project_derived_data.too_many_tasks",
            extra={
                "project_id": project_id,
                "task_count": len(ranges),
                "max_tasks": max_tasks,
            },
        )
        return

    for start, end in ranges:
        process_project_derived_data_batch.delay(
            project_id=project_id,
            group_id_start=start,
            group_id_end=end,
        )


@instrumented_task(
    name="sentry.issues.derived.tasks.process_project_derived_data_batch",
    namespace=issues_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=int(BATCH_PROCESSING_DEADLINE.total_seconds()),
)
def process_project_derived_data_batch(
    project_id: int,
    group_id_start: int,
    group_id_end: int,
    **kwargs: object,
) -> None:
    from sentry.issues.derived.processing import GroupLogDeadlineExceeded, process_group_log
    from sentry.models.group import Group

    deadline = datetime.now(UTC) + BATCH_RETRIGGER_DEADLINE

    group_ids = list(
        Group.objects.filter(
            project_id=project_id,
            id__gte=group_id_start,
            id__lt=group_id_end,
        )
        .order_by("id")
        .values_list("id", flat=True)
    )

    for group_id in group_ids:
        remaining = deadline - datetime.now(UTC)
        try:
            process_group_log(group_id, timeout=remaining)
        except Group.DoesNotExist:
            logger.info(
                "process_project_derived_data_batch.group_not_found",
                extra={"group_id": group_id, "project_id": project_id},
            )
        except GroupLogDeadlineExceeded:
            process_project_derived_data_batch.delay(
                project_id=project_id,
                group_id_start=group_id,
                group_id_end=group_id_end,
            )
            return

        if datetime.now(UTC) >= deadline:
            process_project_derived_data_batch.delay(
                project_id=project_id,
                group_id_start=group_id + 1,
                group_id_end=group_id_end,
            )
            return
