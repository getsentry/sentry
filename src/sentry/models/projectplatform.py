from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    Model, BoundedBigIntegerField, sane_repr
)


class ProjectPlatform(Model):
    """
    Tracks usage of a platform for a given project.
    """
    __core__ = False

    project_id = BoundedBigIntegerField()
    platform = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectplatform'
        unique_together = (('project_id', 'platform'),)

    __repr__ = sane_repr('project_id', 'platform')
