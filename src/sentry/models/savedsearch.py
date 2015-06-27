from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class SavedSearch(Model):
    """
    A saved search query.
    """
    __core__ = True

    project = FlexibleForeignKey('sentry.Project')
    name = models.CharField(max_length=128)
    query = models.TextField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_savedsearch'
        unique_together = (('project', 'name'),)

    __repr__ = sane_repr('project_id', 'name')
