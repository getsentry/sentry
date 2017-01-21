from __future__ import absolute_import

from datetime import timedelta
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from sentry.utils.cache import cache
from sentry.db.models import (
    BoundedPositiveIntegerField, Model, sane_repr
)


class ReleaseEnvironment(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True, null=True)
    project_id = BoundedPositiveIntegerField(db_index=True)
    release_id = BoundedPositiveIntegerField(db_index=True)
    environment_id = BoundedPositiveIntegerField(db_index=True)
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_environmentrelease'
        unique_together = (('project_id', 'release_id', 'environment_id'),)

    __repr__ = sane_repr('project_id', 'release_id', 'environment_id')

    @classmethod
    def get_cache_key(cls, project_id, release_id, environment_id):
        return 'releaseenv:1:{}:{}:{}'.format(
            project_id,
            release_id,
            environment_id,
        )

    @classmethod
    def get_or_create(cls, project, release, environment, datetime, **kwargs):
        cache_key = cls.get_cache_key(project.id, release.id, environment.id)

        instance = cache.get(cache_key)
        if instance is None:
            try:
                with transaction.atomic():
                    instance, created = cls.objects.create(
                        release_id=release.id,
                        project_id=project.id,
                        organization_id=project.organization_id,
                        environment_id=environment.id,
                        first_seen=datetime,
                        last_seen=datetime,
                    ), True
            except IntegrityError:
                instance, created = cls.objects.get(
                    release_id=release.id,
                    project_id=project.id,
                    environment_id=environment.id,
                ), False
            cache.set(cache_key, instance, 3600)
        else:
            created = False

        # TODO(dcramer): this would be good to buffer, but until then we minimize
        # updates to once a minute, and allow Postgres to optimistically skip
        # it even if we can't
        if not created and instance.last_seen < datetime - timedelta(seconds=60):
            cls.objects.filter(
                id=instance.id,
                last_seen__lt=datetime - timedelta(seconds=60),
            ).update(
                last_seen=datetime,
            )
            instance.last_seen = datetime
            cache.set(cache_key, instance, 3600)
        return instance
