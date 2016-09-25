from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)


class Commit(Model):
    __core__ = False

    project_id = BoundedPositiveIntegerField()
    key = models.CharField(max_length=64)
    author = FlexibleForeignKey('sentry.CommitAuthor')
    message = models.TextField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_commit'
        unique_together = (('project_id', 'key'),)

    __repr__ = sane_repr('project_id', 'key')
