from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.utils.cache import cache
from sentry.db.models import (
    BoundedPositiveIntegerField, Model, sane_repr
)


class ReleaseEnvironment(Model):
    __core__ = False

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
            instance, created = cls.objects.get_or_create(
                project_id=project.id,
                release_id=release.id,
                environment_id=environment.id,
                defaults={
                    'first_seen': datetime,
                    'last_seen': datetime,
                },
            )
            cache.set(cache_key, instance, 3600)
        else:
            created = False

        # TODO(dcramer): this would be good to buffer
        if not created:
            instance.update(last_seen=datetime)
        return instance
