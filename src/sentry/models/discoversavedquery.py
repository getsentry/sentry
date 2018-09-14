from __future__ import absolute_import
from django.db import models
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, ArrayField, sane_repr
)


class DiscoverSavedQuery(Model):
    """
    A saved Discover query
    """
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    name = models.CharField(max_length=64)
    project_ids = ArrayField(BoundedPositiveIntegerField())
    fields = ArrayField(models.CharField())
    conditions = ArrayField(ArrayField())
    aggregations = ArrayField(ArrayField())
    start = models.DateTimeField(null=True)
    end = models.DateTimeField(null=True)
    range = models.CharField(max_length=32, null=True)
    order_by = models.CharField(max_length=256, null=True)
    limit = BoundedPositiveIntegerField()
    position = BoundedPositiveIntegerField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_discoversavedquery'

    __repr__ = sane_repr('organization_id', 'name')
