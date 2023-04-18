import logging
import sys
from datetime import timedelta
from typing import TYPE_CHECKING, Iterable, Tuple, Type

import sentry_sdk
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone

from sentry.exceptions import DeleteAborted
from sentry.signals import pending_delete
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry

logger = logging.getLogger("sentry.deletions.api")


MAX_RETRIES = 5

if TYPE_CHECKING:
    from sentry.models import BaseScheduledDeletion


def get_scheduled_deletion_processors() -> Iterable[Tuple[Type["BaseScheduledDeletion"], SiloMode]]:
    # Returns all ScheduledDeletion orm types this process should be handling
    # monolith => both, region => regionscheduleddeletion, control => scheduleddeletion
    from sentry.models.scheduledeletion import get_regional_scheduled_deletion

    if SiloMode.get_current_mode() != SiloMode.REGION:
        yield get_regional_scheduled_deletion(SiloMode.CONTROL), SiloMode.CONTROL
    if SiloMode.get_current_mode() != SiloMode.CONTROL:
        yield get_regional_scheduled_deletion(SiloMode.REGION), SiloMode.REGION


@instrumented_task(
    name="sentry.tasks.deletion.reattempt_deletions", queue="cleanup", acks_late=True
)
def reattempt_deletions():
    for deletion_orm, _ in get_scheduled_deletion_processors():
        # If a deletion is in progress and was scheduled to run more than
        # a day ago we can assume the previous job died/failed.
        # Turning off the in_progress flag will result in the job being picked
        # up in the next deletion run allowing us to start over.
        queryset = deletion_orm.objects.filter(
            in_progress=True, date_scheduled__lte=timezone.now() - timedelta(days=1)
        )
        queryset.update(in_progress=False)


@instrumented_task(
    name="sentry.tasks.deletion.run_scheduled_deletions", queue="cleanup", acks_late=True
)
def run_scheduled_deletions():
    for deletion_orm, silo_mode in get_scheduled_deletion_processors():
        queryset = deletion_orm.objects.filter(
            in_progress=False, date_scheduled__lte=timezone.now()
        )
        for item in queryset:
            with transaction.atomic():
                affected = deletion_orm.objects.filter(
                    id=item.id,
                    in_progress=False,
                ).update(in_progress=True)
                if not affected:
                    continue

                run_deletion.delay(deletion_id=item.id, silo_mode=silo_mode.name)


@instrumented_task(
    name="sentry.tasks.deletion.run_deletion",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
@retry(exclude=(DeleteAborted,))
def run_deletion(deletion_id, first_pass=True, silo_mode="CONTROL"):
    from sentry import deletions
    from sentry.models.scheduledeletion import get_regional_scheduled_deletion

    scheduled_deletion_orm = get_regional_scheduled_deletion(SiloMode[silo_mode])

    logger.info(
        "deletion.started",
        extra={
            "deletion_id": deletion_id,
            "first_pass": first_pass,
        },
    )

    try:
        deletion = scheduled_deletion_orm.objects.get(id=deletion_id)
    except scheduled_deletion_orm.DoesNotExist:
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
            run_deletion.apply_async(
                kwargs={"deletion_id": deletion_id, "first_pass": False, "silo_mode": silo_mode},
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
        if "pytest" in sys.modules:
            raise err
