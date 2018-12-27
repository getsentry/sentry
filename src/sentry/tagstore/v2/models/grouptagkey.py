"""
sentry.tagstore.v2.models.grouptagkey
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import router, transaction, DataError, connections

from sentry.db.models import (
    Model, BoundedPositiveIntegerField, BoundedBigIntegerField, FlexibleForeignKey, sane_repr
)
from sentry.tagstore.query import TagStoreManager


class GroupTagKey(Model):
    """
    Stores a unique tag key name for a group.

    An example key might be "url" or "server_name".
    """
    __core__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    group_id = BoundedBigIntegerField(db_index=True)
    _key = FlexibleForeignKey('tagstore.TagKey', db_column='key_id')
    values_seen = BoundedPositiveIntegerField(default=0)

    objects = TagStoreManager()

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', 'group_id', '_key'), )

    __repr__ = sane_repr('project_id', 'group_id', '_key_id')

    def delete(self):
        using = router.db_for_read(GroupTagKey)
        cursor = connections[using].cursor()
        cursor.execute(
            """
            DELETE FROM tagstore_grouptagkey
            WHERE project_id = %s
              AND id = %s
        """, [self.project_id, self.id]
        )

    @property
    def key(self):
        if hasattr(self, '_set_key'):
            return self._set_key

        if hasattr(self, '__key_cache'):
            return self._key.key

        # fallback
        from sentry.tagstore.v2.models import TagKey

        tk = TagKey.objects.filter(
            project_id=self.project_id,
            id=self._key_id,
        ).values_list('key', flat=True).get()

        # cache for future calls
        self.key = tk

        return tk

    @key.setter
    def key(self, key):
        self._set_key = key

    def merge_counts(self, new_group):
        from sentry.tagstore.v2.models import GroupTagValue

        try:
            with transaction.atomic(using=router.db_for_write(GroupTagKey)):
                GroupTagKey.objects.filter(
                    group_id=new_group.id,
                    project_id=new_group.project_id,
                    _key_id=self._key_id,
                ).update(
                    values_seen=GroupTagValue.objects.filter(
                        group_id=new_group.id,
                        project_id=new_group.project_id,
                        _key_id=self._key_id,
                    ).count()
                )
        except DataError:
            # it's possible to hit an out of range value for counters
            pass
