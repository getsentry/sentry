import logging
from datetime import timedelta
from uuid import uuid4

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone

from sentry.exceptions import DeleteAborted
from sentry.signals import pending_delete
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation

logger = logging.getLogger("sentry.deletions.api")


MAX_RETRIES = 5


@instrumented_task(
    name="sentry.tasks.deletion.reattempt_deletions", queue="cleanup", acks_late=True
)
def reattempt_deletions():
    from sentry.models import ScheduledDeletion

    # If a deletion is in progress and was scheduled to run more than
    # a day ago we can assume the previous job died/failed.
    # Turning off the in_progress flag will result in the job being picked
    # up in the next deletion run allowing us to start over.
    queryset = ScheduledDeletion.objects.filter(
        in_progress=True, date_scheduled__lte=timezone.now() - timedelta(days=1)
    )
    queryset.update(in_progress=False)


@instrumented_task(
    name="sentry.tasks.deletion.run_scheduled_deletions", queue="cleanup", acks_late=True
)
def run_scheduled_deletions():
    from sentry.models import ScheduledDeletion

    queryset = ScheduledDeletion.objects.filter(
        in_progress=False, date_scheduled__lte=timezone.now()
    )
    for item in queryset:
        with transaction.atomic():
            affected = ScheduledDeletion.objects.filter(
                id=item.id,
                in_progress=False,
            ).update(in_progress=True)
            if not affected:
                continue

            run_deletion.delay(deletion_id=item.id)


@instrumented_task(
    name="sentry.tasks.deletion.run_deletion",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
@retry(exclude=(DeleteAborted,))
def run_deletion(deletion_id, first_pass=True):
    from sentry import deletions
    from sentry.models import ScheduledDeletion

    try:
        deletion = ScheduledDeletion.objects.get(id=deletion_id)
    except ScheduledDeletion.DoesNotExist:
        return

    try:
        instance = deletion.get_instance()
    except ObjectDoesNotExist:
        logger.info(
            "object.delete.object-missing",
            extra={
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
                "object_id": deletion.object_id,
                "transaction_id": deletion.guid,
                "model": deletion.model_name,
            },
        )
        deletion.delete()
        return

    has_more = task.chunk()
    if has_more:
        run_deletion.apply_async(
            kwargs={"deletion_id": deletion_id, "first_pass": False}, countdown=15
        )
    else:
        deletion.delete()


@instrumented_task(
    name="sentry.tasks.deletion.delete_groups",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
@retry(exclude=(DeleteAborted,))
@track_group_async_operation
def delete_groups(object_ids, transaction_id=None, eventstream_state=None, **kwargs):
    from sentry import deletions, eventstream
    from sentry.models import Group

    transaction_id = transaction_id or uuid4().hex

    max_batch_size = 100
    current_batch, rest = object_ids[:max_batch_size], object_ids[max_batch_size:]

    task = deletions.get(
        model=Group, query={"id__in": current_batch}, transaction_id=transaction_id
    )
    has_more = task.chunk()
    if has_more or rest:
        delete_groups.apply_async(
            kwargs={
                "object_ids": object_ids if has_more else rest,
                "transaction_id": transaction_id,
                "eventstream_state": eventstream_state,
            },
            countdown=15,
        )
    else:
        # all groups have been deleted
        if eventstream_state:
            eventstream.end_delete_groups(eventstream_state)
