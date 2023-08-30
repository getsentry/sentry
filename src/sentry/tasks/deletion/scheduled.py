import logging
from datetime import timedelta
from typing import Any, Type

import sentry_sdk
from celery import Task
from django.core.exceptions import ObjectDoesNotExist
from django.db import router, transaction
from django.utils import timezone

from sentry.exceptions import DeleteAborted
from sentry.models.scheduledeletion import (
    BaseScheduledDeletion,
    RegionScheduledDeletion,
    ScheduledDeletion,
)
from sentry.signals import pending_delete
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.utils.env import in_test_environment

logger = logging.getLogger("sentry.deletions.api")


MAX_RETRIES = 5


@instrumented_task(
    name="sentry.tasks.deletion.reattempt_deletions_control",
    queue="cleanup.control",
    acks_late=True,
    silo_mode=SiloMode.CONTROL,
)
def reattempt_deletions_control():
    _reattempt_deletions(ScheduledDeletion)


@instrumented_task(
    name="sentry.tasks.deletion.reattempt_deletions",
    queue="cleanup",
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def reattempt_deletions():
    _reattempt_deletions(RegionScheduledDeletion)


def _reattempt_deletions(model_class: Type[BaseScheduledDeletion]) -> None:
    # If a deletion is in progress and was scheduled to run more than
    # a day ago we can assume the previous job died/failed.
    # Turning off the in_progress flag will result in the job being picked
    # up in the next deletion run allowing us to start over.
    queryset = model_class.objects.filter(
        in_progress=True, date_scheduled__lte=timezone.now() - timedelta(days=1)
    )
    queryset.update(in_progress=False)


@instrumented_task(
    name="sentry.tasks.deletion.run_scheduled_deletions_control",
    queue="cleanup.control",
    acks_late=True,
)
def run_scheduled_deletions_control() -> None:
    _run_scheduled_deletions(
        model_class=ScheduledDeletion,
        process_task=run_deletion_control,
    )


@instrumented_task(
    name="sentry.tasks.deletion.run_scheduled_deletions", queue="cleanup", acks_late=True
)
def run_scheduled_deletions() -> None:
    _run_scheduled_deletions(
        model_class=RegionScheduledDeletion,
        process_task=run_deletion,
    )


def _run_scheduled_deletions(model_class: Type[BaseScheduledDeletion], process_task: Task) -> None:
    queryset = model_class.objects.filter(in_progress=False, date_scheduled__lte=timezone.now())
    for item in queryset:
        with transaction.atomic(router.db_for_write(model_class)):
            affected = model_class.objects.filter(
                id=item.id,
                in_progress=False,
            ).update(in_progress=True)
            if not affected:
                continue

        process_task.delay(deletion_id=item.id)


@instrumented_task(
    name="sentry.tasks.deletion.run_deletion_control",
    queue="cleanup.control",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(DeleteAborted,))
def run_deletion_control(deletion_id, first_pass=True, **kwargs: Any):
    _run_deletion(
        deletion_id=deletion_id,
        first_pass=first_pass,
        model_class=ScheduledDeletion,
        process_task=run_deletion_control,
    )


@instrumented_task(
    name="sentry.tasks.deletion.run_deletion",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(DeleteAborted,))
def run_deletion(deletion_id, first_pass=True, **kwargs: Any):
    _run_deletion(
        deletion_id=deletion_id,
        first_pass=first_pass,
        model_class=RegionScheduledDeletion,
        process_task=run_deletion,
    )


def _run_deletion(
    deletion_id: int,
    first_pass: bool,
    model_class: Type[BaseScheduledDeletion],
    process_task: Task,
) -> None:
    from sentry import deletions

    logger.info(
        "deletion.started",
        extra={
            "deletion_id": deletion_id,
            "first_pass": first_pass,
        },
    )

    try:
        deletion = model_class.objects.get(id=deletion_id)
    except model_class.DoesNotExist:
        return

    try:
        instance = deletion.get_instance()
    except ObjectDoesNotExist:
        logger.info(
            "object.delete.object-missing",
            extra={
                "deletion_id": deletion_id,
                "object_id": deletion.object_id,
                "transaction_id": deletion.guid,
                "model": deletion.model_name,
            },
        )
        deletion.delete()
        return

    task = deletions.get(
        model=deletion.get_model(),
        query={"id": deletion.object_id},
        transaction_id=deletion.guid,
        actor_id=deletion.actor_id,
    )

    if not task.should_proceed(instance):
        logger.info(
            "object.delete.aborted",
            extra={
                "deletion_id": deletion_id,
                "object_id": deletion.object_id,
                "transaction_id": deletion.guid,
                "model": deletion.model_name,
            },
        )
        deletion.delete()
        return

    if first_pass:
        actor = deletion.get_actor()
        pending_delete.send(sender=type(instance), instance=instance, actor=actor)

    try:
        has_more = task.chunk()
        if has_more:
            process_task.apply_async(
                kwargs={
                    "deletion_id": deletion_id,
                    "first_pass": False,
                },
                countdown=15,
            )
        else:
            deletion.delete()
    except Exception as err:
        sentry_sdk.set_context(
            "deletion",
            {
                "id": deletion.id,
                "model": deletion.model_name,
                "object_id": deletion.object_id,
            },
        )
        sentry_sdk.capture_exception(err)
        if in_test_environment():
            raise err
