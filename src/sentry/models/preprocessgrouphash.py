from __future__ import absolute_import

from django.db import models

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model


class PreProcessGroupHash(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    hash = models.CharField(max_length=32)
    group_tombstone_id = BoundedPositiveIntegerField(db_index=True, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_preprocessgrouphash'
        unique_together = (('project', 'hash'), )
