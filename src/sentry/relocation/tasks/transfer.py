import logging

from celery import Task
from django.db.models import Subquery
from django.utils import timezone

from sentry.relocation.models.relocationtransfer import (
    MAX_AGE,
    RETRY_BACKOFF,
    BaseRelocationTransfer,
    ControlRelocationTransfer,
    RegionRelocationTransfer,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task

logger = logging.getLogger("sentry.relocation.tasks")


@instrumented_task(
    name="sentry.relocation.transfer.find_relocation_transfer_control",
    queue="relocation.control",
    silo_mode=SiloMode.CONTROL,
)
def find_relocation_transfer_control() -> None:
    _find_relocation_transfer(ControlRelocationTransfer, process_relocation_transfer_control)


@instrumented_task(
    name="sentry.relocation.transfer.find_relocation_transfer_region",
    queue="relocation",
    silo_mode=SiloMode.REGION,
)
def find_relocation_transfer_region() -> None:
    _find_relocation_transfer(RegionRelocationTransfer, process_relocation_transfer_region)


def _find_relocation_transfer(
    model_cls: type[BaseRelocationTransfer],
    process_task: Task,
) -> None:
    """
    Advance the scheduled_for time for all transfers that are
    due, and schedule processing tasks for them.
    """
    now = timezone.now()
    scheduled_ids = model_cls.objects.filter(
        scheduled_for__lte=now,
        date_added__gte=now - MAX_AGE,
    ).values("id")

    for transfer_id in scheduled_ids:
        process_task.delay(id=transfer_id)

    if len(scheduled_ids):
        # Advance next retry time in case these deliveries fail.
        model_cls.objects.filter(id__in=Subquery(scheduled_ids)).update(
            scheduled_for=timezone.now() + RETRY_BACKOFF
        )

    # Garbage collect expired transfers. Because relocations are
    # expected to complete in 1 hour we should purge transfers older than
    # that.
    now = timezone.now()
    expired = model_cls.objects.filter(date_added__lte=now - MAX_AGE)
    for item in expired:
        logger.warning(
            "relocation.expired",
            extra={
                "relocation_uuid": item.relocation_uuid,
                "org_slug": item.org_slug,
                "requesting_region": item.requesting_region,
                "exporting_region": item.exporting_region,
            },
        )
        item.delete()


@instrumented_task(
    name="sentry.relocation.transfer.process_relocation_transfer_control",
    queue="relocation.control",
    silo_mode=SiloMode.CONTROL,
)
def process_relocation_transfer_control(transfer_id: int) -> None:
    pass


@instrumented_task(
    name="sentry.relocation.transfer.process_relocation_transfer_region",
    queue="relocation",
    silo_mode=SiloMode.REGION,
)
def process_relocation_transfer_region(transfer_id: int) -> None:
    pass
