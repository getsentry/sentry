from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField, Model, sane_repr
)


class GroupLocation(Model):
    __core__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    group_id = BoundedBigIntegerField()
    city_id = BoundedBigIntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_grouplocation'

    __repr__ = sane_repr('group_id', 'city_id', 'date_added')
