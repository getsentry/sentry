from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, Model, sane_repr
)


class Repository(Model):
    __core__ = True

    organization_id = BoundedPositiveIntegerField(db_index=True)
    name = models.CharField(max_length=200)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_repository'
        unique_together = (('organization_id', 'name'),)

    __repr__ = sane_repr('organization_id', 'name')
