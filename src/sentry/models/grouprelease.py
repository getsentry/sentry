from __future__ import absolute_import

from django.db import models
from django.utils import timezone

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
