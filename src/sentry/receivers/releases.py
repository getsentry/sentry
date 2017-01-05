from __future__ import absolute_import, print_function

from django.db import transaction
from django.db.models.signals import post_save

from sentry.models import Release, TagValue
from sentry.tasks.clear_expired_resolutions import clear_expired_resolutions


def ensure_release_exists(instance, created, **kwargs):
    if instance.key != 'sentry:release':
        return

    if instance.data and instance.data.get('release_id'):
        return

    with transaction.atomic():
        release = Release.objects.filter(
            organization_id=instance.project.organization_id,
            version=instance.value
        ).first()
        if release:
            release.update(date_added=instance.first_seen)
        else:
            release = Release.objects.create(
                organization_id=instance.project.organization_id,
                version=instance.value,
                date_added=instance.first_seen,
            )
            instance.update(data={'release_id': release.id})
        release.add_project(instance.project)


def resolve_group_resolutions(instance, created, **kwargs):
    if not created:
        return

    clear_expired_resolutions.delay(release_id=instance.id)


post_save.connect(
    resolve_group_resolutions,
    sender=Release,
    dispatch_uid="resolve_group_resolutions",
    weak=False
)


post_save.connect(
    ensure_release_exists,
    sender=TagValue,
    dispatch_uid="ensure_release_exists",
    weak=False
)
