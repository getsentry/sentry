from __future__ import absolute_import

from sentry.db.models import BoundedPositiveIntegerField, Model, sane_repr
from sentry.utils.cache import cache


class GroupEnvironment(Model):
    __core__ = False

    group_id = BoundedPositiveIntegerField()
    environment_id = BoundedPositiveIntegerField()
    first_release_id = BoundedPositiveIntegerField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupenvironment'
        unique_together = [
            ('group_id', 'environment_id'),
        ]

    __repr__ = sane_repr('group_id', 'environment_id')

    @classmethod
    def get_or_create(cls, group_id, environment_id, defaults=None):
        cache_key = 'groupenv:1:{}:{}'.format(group_id, environment_id)
        instance = cache.get(cache_key)
        if instance is None:
            instance, created = cls.objects.get_or_create(
                group_id=group_id,
                environment_id=environment_id,
                defaults=defaults,
            )
            cache.set(cache_key, instance, 3600)
        else:
            created = False

        return instance, created
