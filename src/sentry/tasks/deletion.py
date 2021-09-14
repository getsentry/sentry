import logging
from datetime import timedelta
from uuid import uuid4

from django.apps import apps
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone

from sentry.constants import ObjectStatus
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
    name="sentry.tasks.deletion.revoke_api_tokens",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
@retry(exclude=(DeleteAborted,))
def revoke_api_tokens(object_id, transaction_id=None, timestamp=None, **kwargs):
    from sentry.models import ApiToken

    queryset = ApiToken.objects.filter(application=object_id)
    if timestamp:
        queryset = queryset.filter(date_added__lte=timestamp)

    # we're using a slow deletion strategy to avoid a lot of custom code for
    # postgres
    has_more = False
    for obj in queryset[:1000]:
        obj.delete()
        has_more = True

    if has_more:
        revoke_api_tokens.apply_async(
            kwargs={
                "object_id": object_id,
                "transaction_id": transaction_id,
                "timestamp": timestamp,
            },
            countdown=15,
        )
    return has_more


@instrumented_task(
    name="sentry.tasks.deletion.delete_organization",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
@retry(exclude=(DeleteAborted,))
def delete_organization(object_id, transaction_id=None, actor_id=None, **kwargs):
    # TODO(mark) remove this task once all in flight jobs have been processed.
    from sentry import deletions
    from sentry.models import Organization, OrganizationStatus

    try:
        instance = Organization.objects.get(id=object_id)
    except Organization.DoesNotExist:
        return

    if instance.status == OrganizationStatus.VISIBLE:
        raise DeleteAborted

    # compat: can be removed after we switch to scheduled deletions
    if instance.status != OrganizationStatus.DELETION_IN_PROGRESS:
        pending_delete.send(sender=type(instance), instance=instance)

    task = deletions.get(
        model=Organization,
        query={"id": object_id},
        transaction_id=transaction_id or uuid4().hex,
        actor_id=actor_id,
    )
    has_more = task.chunk()
    if has_more:
        delete_organization.apply_async(
            kwargs={"object_id": object_id, "transaction_id": transaction_id, "actor_id": actor_id},
            countdown=15,
        )


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


@instrumented_task(
    name="sentry.tasks.deletion.delete_api_application",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
@retry(exclude=(DeleteAborted,))
def delete_api_application(object_id, transaction_id=None, **kwargs):
    # TODO this method is no longer in use and should be removed when jobs are
    # no longer being enqueued for it.
    from sentry import deletions
    from sentry.models import ApiApplication, ApiApplicationStatus

    try:
        instance = ApiApplication.objects.get(id=object_id)
    except ApiApplication.DoesNotExist:
        return

    if instance.status == ApiApplicationStatus.active:
        raise DeleteAborted

    task = deletions.get(
        model=ApiApplication, query={"id": object_id}, transaction_id=transaction_id or uuid4().hex
    )
    has_more = task.chunk()
    if has_more:
        delete_api_application.apply_async(
            kwargs={"object_id": object_id, "transaction_id": transaction_id}, countdown=15
        )


@instrumented_task(
    name="sentry.tasks.deletion.generic_delete",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
@retry(exclude=(DeleteAborted,))
def generic_delete(app_label, model_name, object_id, transaction_id=None, actor_id=None, **kwargs):
    from sentry import deletions
    from sentry.models import User

    model = apps.get_model(app_label, model_name)

    try:
        instance = model.objects.get(id=object_id)
    except model.DoesNotExist:
        return

    if instance.status != ObjectStatus.DELETION_IN_PROGRESS:
        pending_delete.send(
            sender=type(instance),
            instance=instance,
            actor=User.objects.get(id=actor_id) if actor_id else None,
        )

    if instance.status == ObjectStatus.VISIBLE:
        raise DeleteAborted

    task = deletions.get(
        model=model,
        actor_id=actor_id,
        query={"id": object_id},
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        generic_delete.apply_async(
            kwargs={
                "app_label": app_label,
                "model_name": model_name,
                "object_id": object_id,
                "transaction_id": transaction_id,
                "actor_id": actor_id,
            },
            countdown=15,
        )


@instrumented_task(
    name="sentry.tasks.deletion.delete_repository",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
@retry(exclude=(DeleteAborted,))
def delete_repository(object_id, transaction_id=None, actor_id=None, **kwargs):
    # TODO this method is no longer in use and should be removed when jobs are
    # no longer being enqueued for it.
    from sentry import deletions
    from sentry.models import Repository, User

    try:
        instance = Repository.objects.get(id=object_id)
    except Repository.DoesNotExist:
        return

    if instance.status == ObjectStatus.VISIBLE:
        raise DeleteAborted

    # compat: can be removed after we switch to scheduled deletions
    if instance.status != ObjectStatus.DELETION_IN_PROGRESS:
        pending_delete.send(
            sender=type(instance),
            instance=instance,
            actor=User.objects.get(id=actor_id) if actor_id else None,
        )

    task = deletions.get(
        model=Repository,
        actor_id=actor_id,
        query={"id": object_id},
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_repository.apply_async(
            kwargs={"object_id": object_id, "transaction_id": transaction_id, "actor_id": actor_id},
            countdown=15,
        )


@instrumented_task(
    name="sentry.tasks.deletion.delete_organization_integration",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
@retry(exclude=(DeleteAborted,))
def delete_organization_integration(object_id, transaction_id=None, actor_id=None, **kwargs):
    from sentry import deletions
    from sentry.models import Identity, OrganizationIntegration, Repository

    try:
        instance = OrganizationIntegration.objects.get(id=object_id)
    except OrganizationIntegration.DoesNotExist:
        return

    if instance.status == ObjectStatus.VISIBLE:
        raise DeleteAborted

    # dissociate repos from that integration
    Repository.objects.filter(
        organization_id=instance.organization_id, integration_id=instance.integration_id
    ).update(integration_id=None)

    # delete the identity attached through the default_auth_id
    if instance.default_auth_id:
        log_info = {
            "integration_id": instance.integration_id,
            "identity_id": instance.default_auth_id,
        }
        try:
            identity = Identity.objects.get(id=instance.default_auth_id)
        except Identity.DoesNotExist:
            # the identity may not exist for a variety of reasons but for debugging purposes
            # we should keep track
            logger.info("delete_organization_integration.identity_does_not_exist", extra=log_info)
        else:
            identity.delete()
            logger.info("delete_organization_integration.identity_deleted", extra=log_info)

    task = deletions.get(
        model=OrganizationIntegration,
        actor_id=actor_id,
        query={"id": object_id},
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_organization_integration.apply_async(
            kwargs={"object_id": object_id, "transaction_id": transaction_id, "actor_id": actor_id},
            countdown=15,
        )
