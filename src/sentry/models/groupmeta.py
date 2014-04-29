"""
sentry.models.groupmeta
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db import models

from sentry.db.models import Model, sane_repr
from sentry.db.models.manager import BaseManager


class GroupMetaManager(BaseManager):
    def get_value_bulk(self, instances, key):
        return dict(self.filter(
            group__in=instances,
            key=key,
        ).values_list('group', 'value'))

    def get_value(self, instance, key, default=None):
        try:
            return self.get(
                group=instance,
                key=key,
            )
        except self.model.DoesNotExist:
            return default

    def unset_value(self, instance, key):
        self.filter(group=instance, key=key).delete()

    def set_value(self, instance, key, value):
        inst, created = self.get_or_create(
            group=instance,
            key=key,
            defaults={
                'value': value,
            },
        )
        if not created and inst.value != value:
            inst.update(value=value)


class GroupMeta(Model):
    """
    Arbitrary key/value store for Groups.

    Generally useful for things like storing metadata
    provided by plugins.
    """
    group = models.ForeignKey('sentry.Group')
    key = models.CharField(max_length=64)
    value = models.TextField()

    objects = GroupMetaManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupmeta'
        unique_together = (('group', 'key'),)

    __repr__ = sane_repr('group_id', 'key', 'value')
