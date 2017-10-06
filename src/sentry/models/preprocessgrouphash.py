from __future__ import absolute_import

from django.db import models

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model


class FilteredGroupHash(Model):
    """
    Similar to GroupHash, but used only for filtering, and hashing is
    based on unprocessed data, so hashing methods used to generate
    these are slightly different.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    hash = models.CharField(max_length=32)
    group_tombstone_id = BoundedPositiveIntegerField(db_index=True, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_filteredgrouphash'
        unique_together = (('project', 'hash'), )
