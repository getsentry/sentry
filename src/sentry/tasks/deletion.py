from __future__ import absolute_import

from uuid import uuid4

from django.conf import settings
from django.db import transaction
from django.db.models import get_model
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.exceptions import DeleteAborted
from sentry.signals import pending_delete
from sentry.tasks.base import instrumented_task, retry

# in prod we run with infinite retries to recover from errors
# in debug/development, we assume these tasks generally shouldn't fail
MAX_RETRIES = 1 if settings.DEBUG else None
MAX_RETRIES = 1


@instrumented_task(name='sentry.tasks.deletion.run_scheduled_deletions', queue='cleanup')
def run_scheduled_deletions():
    from sentry.models import ScheduledDeletion

    queryset = ScheduledDeletion.objects.filter(
        in_progress=False,
        aborted=False,
        date_scheduled__lte=timezone.now(),
    )
    for item in queryset:
        with transaction.atomic():
            affected = ScheduledDeletion.objects.filter(
                id=item.id,
                in_progress=False,
                aborted=False,
            ).update(
                in_progress=True,
            )
            if not affected:
                continue

            run_deletion.delay(deletion_id=item.id)


@instrumented_task(
    name='sentry.tasks.deletion.run_deletion',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def run_deletion(deletion_id):
    from sentry import deletions
    from sentry.models import ScheduledDeletion

    try:
        deletion = ScheduledDeletion.objects.get(
            id=deletion_id,
        )
    except ScheduledDeletion.DoesNotExist:
        return

    if deletion.aborted:
        raise DeleteAborted

    if not deletion.in_progress:
        actor = deletion.get_actor()
        instance = deletion.get_instance()
        with transaction.atomc():
            deletion.update(in_progress=True)
            pending_delete.send(
                sender=type(instance),
                instance=instance,
                actor=actor,
            )

    task = deletions.get(
        model=deletion.get_model(),
        query={
            'id': deletion.object_id,
        },
        transaction_id=deletion.guid,
        actor_id=deletion.actor_id,
    )
    has_more = task.chunk()
    if has_more:
        run_deletion.apply_async(
            kwargs={'deletion_id': deletion_id},
            countdown=15,
        )
    deletion.delete()


@instrumented_task(
    name='sentry.tasks.deletion.revoke_api_tokens',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def revoke_api_tokens(object_id, transaction_id=None, timestamp=None, **kwargs):
    from sentry.models import ApiToken

    queryset = ApiToken.objects.filter(
        application=object_id,
    )
    if timestamp:
        queryset = queryset.filter(date_added__lte=timestamp)

    # we're using a slow deletion strategy to avoid a lot of custom code for
    # mysql/postgres
    has_more = False
    for obj in queryset[:1000]:
        obj.delete()
        has_more = True

    if has_more:
        revoke_api_tokens.apply_async(
            kwargs={
                'object_id': object_id,
                'transaction_id': transaction_id,
                'timestamp': timestamp,
            },
            countdown=15,
        )
    return has_more


@instrumented_task(
    name='sentry.tasks.deletion.delete_organization',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def delete_organization(object_id, transaction_id=None, **kwargs):
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
        pending_delete.send(
            sender=type(instance),
            instance=instance,
        )

    task = deletions.get(
        model=Organization,
        query={
            'id': object_id,
        },
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_organization.apply_async(
            kwargs={'object_id': object_id,
                    'transaction_id': transaction_id},
            countdown=15,
        )


@instrumented_task(
    name='sentry.tasks.deletion.delete_team',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def delete_team(object_id, transaction_id=None, **kwargs):
    from sentry import deletions
    from sentry.models import Team, TeamStatus

    try:
        instance = Team.objects.get(id=object_id)
    except Team.DoesNotExist:
        return

    if instance.status == TeamStatus.VISIBLE:
        raise DeleteAborted

    task = deletions.get(
        model=Team,
        query={
            'id': object_id,
        },
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_team.apply_async(
            kwargs={'object_id': object_id,
                    'transaction_id': transaction_id},
            countdown=15,
        )


@instrumented_task(
    name='sentry.tasks.deletion.delete_project',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def delete_project(object_id, transaction_id=None, **kwargs):
    from sentry import deletions
    from sentry.models import Project, ProjectStatus

    try:
        instance = Project.objects.get(id=object_id)
    except Project.DoesNotExist:
        return

    if instance.status == ProjectStatus.VISIBLE:
        raise DeleteAborted

    task = deletions.get(
        model=Project,
        query={
            'id': object_id,
        },
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_project.apply_async(
            kwargs={'object_id': object_id,
                    'transaction_id': transaction_id},
            countdown=15,
        )


@instrumented_task(
    name='sentry.tasks.deletion.delete_group',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def delete_group(object_id, transaction_id=None, **kwargs):
    from sentry import deletions
    from sentry.models import Group

    task = deletions.get(
        model=Group,
        query={
            'id': object_id,
        },
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_group.apply_async(
            kwargs={'object_id': object_id,
                    'transaction_id': transaction_id},
            countdown=15,
        )


@instrumented_task(
    name='sentry.tasks.deletion.delete_tag_key',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def delete_tag_key(object_id, transaction_id=None, **kwargs):
    from sentry import deletions
    from sentry.models import TagKey

    task = deletions.get(
        model=TagKey,
        query={
            'id': object_id,
        },
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_tag_key.apply_async(
            kwargs={'object_id': object_id,
                    'transaction_id': transaction_id},
            countdown=15,
        )


@instrumented_task(
    name='sentry.tasks.deletion.delete_api_application',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def delete_api_application(object_id, transaction_id=None, **kwargs):
    from sentry import deletions
    from sentry.models import ApiApplication, ApiApplicationStatus

    try:
        instance = ApiApplication.objects.get(id=object_id)
    except ApiApplication.DoesNotExist:
        return

    if instance.status == ApiApplicationStatus.active:
        raise DeleteAborted

    task = deletions.get(
        model=ApiApplication,
        query={
            'id': object_id,
        },
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_api_application.apply_async(
            kwargs={'object_id': object_id,
                    'transaction_id': transaction_id},
            countdown=15,
        )


@instrumented_task(
    name='sentry.tasks.deletion.generic_delete',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def generic_delete(app_label, model_name, object_id, transaction_id=None, actor_id=None, **kwargs):
    from sentry import deletions

    model = get_model(app_label, model_name)

    try:
        instance = model.objects.get(id=object_id)
    except model.DoesNotExist:
        return

    if instance.status == ObjectStatus.VISIBLE:
        raise DeleteAborted

    task = deletions.get(
        model=model,
        actor_id=actor_id,
        query={
            'id': object_id,
        },
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        generic_delete.apply_async(
            kwargs={
                'app_label': app_label,
                'model_name': model_name,
                'object_id': object_id,
                'transaction_id': transaction_id,
                'actor_id': actor_id,
            },
            countdown=15,
        )


@instrumented_task(
    name='sentry.tasks.deletion.delete_repository',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def delete_repository(object_id, transaction_id=None, actor_id=None, **kwargs):
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
        query={
            'id': object_id,
        },
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_repository.apply_async(
            kwargs={
                'object_id': object_id,
                'transaction_id': transaction_id,
                'actor_id': actor_id,
            },
            countdown=15,
        )
