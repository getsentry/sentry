from __future__ import absolute_import, print_function

from django.db import IntegrityError, transaction
from django.db.models.signals import post_save

from sentry.models import (
    Activity, Commit, GroupAssignee, GroupCommitResolution, Project, Release, TagValue
)
from sentry.tasks.clear_expired_resolutions import clear_expired_resolutions


def ensure_release_exists(instance, created, **kwargs):
    if instance.key != 'sentry:release':
        return

    if instance.data and instance.data.get('release_id'):
        return

    project = Project.objects.get(pk=instance.project_id)

    try:
        with transaction.atomic():
            release = Release.objects.create(
                organization_id=project.organization_id,
                version=instance.value,
                date_added=instance.first_seen,
            )
    except IntegrityError:
        release = Release.objects.get(
            organization_id=project.organization_id,
            version=instance.value,
        )
        release.update(date_added=instance.first_seen)
    else:
        instance.update(data={'release_id': release.id})

    release.add_project(project)


def resolve_group_resolutions(instance, created, **kwargs):
    if not created:
        return

    clear_expired_resolutions.delay(release_id=instance.id)


def resolved_in_commit(instance, created, **kwargs):
    # TODO(dcramer): we probably should support an updated message
    if not created:
        return

    groups = instance.find_referenced_groups()
    for group in groups:
        try:
            with transaction.atomic():
                GroupCommitResolution.objects.create(
                    group_id=group.id,
                    commit_id=instance.id,
                )
                if instance.author:
                    user_list = list(instance.author.find_users())
                else:
                    user_list = ()
                if user_list:
                    Activity.objects.create(
                        project_id=group.project_id,
                        group=group,
                        type=Activity.SET_RESOLVED_IN_COMMIT,
                        ident=instance.id,
                        user=user_list[0],
                        data={
                            'commit': instance.id,
                        }
                    )
                    GroupAssignee.objects.assign(
                        group=group, assigned_to=user_list[0], acting_user=user_list[0])
                else:
                    Activity.objects.create(
                        project_id=group.project_id,
                        group=group,
                        type=Activity.SET_RESOLVED_IN_COMMIT,
                        ident=instance.id,
                        data={
                            'commit': instance.id,
                        }
                    )
        except IntegrityError:
            pass


post_save.connect(
    resolve_group_resolutions, sender=Release, dispatch_uid="resolve_group_resolutions", weak=False
)

post_save.connect(
    ensure_release_exists, sender=TagValue, dispatch_uid="ensure_release_exists", weak=False
)

post_save.connect(
    resolved_in_commit,
    sender=Commit,
    dispatch_uid="resolved_in_commit",
    weak=False,
)
