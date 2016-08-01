from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text
from sentry.db.models import (
    BoundedPositiveIntegerField, Model, sane_repr
)


class GroupRelease(Model):
    __core__ = False

    project_id = BoundedPositiveIntegerField(db_index=True)
    group_id = BoundedPositiveIntegerField()
    release_id = BoundedPositiveIntegerField(db_index=True)
    environment = models.CharField(max_length=64, default='')
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_grouprelease'
        unique_together = (('group_id', 'release_id', 'environment'),)

    __repr__ = sane_repr('group_id', 'release_id')

    @classmethod
    def get_cache_key(cls, group_id, release_id, environment):
        return 'grouprelease:1:{}:{}'.format(
            group_id,
            md5_text('{}:{}'.format(release_id, environment)).hexdigest(),
        )

    @classmethod
    def get_or_create(cls, group, release, environment, datetime, **kwargs):
        cache_key = cls.get_cache_key(group.id, release.id, environment.name)

        instance = cache.get(cache_key)
        if instance is None:
            instance, created = cls.objects.get_or_create(
                release_id=release.id,
                group_id=group.id,
                environment=environment.name,
                defaults={
                    'project_id': group.project_id,
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
