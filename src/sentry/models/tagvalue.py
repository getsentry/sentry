"""
sentry.models.tagvalue
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db import models
from django.utils import timezone

from sentry.constants import MAX_TAG_KEY_LENGTH, MAX_TAG_VALUE_LENGTH
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, GzippedDictField, BaseManager,
    sane_repr
)


class TagValue(Model):
    """
    Stores references to available filters.
    """
    project = models.ForeignKey('sentry.Project', null=True)
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    value = models.CharField(max_length=MAX_TAG_VALUE_LENGTH)
    data = GzippedDictField(blank=True, null=True)
    times_seen = BoundedPositiveIntegerField(default=0)
    last_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_filtervalue'
        unique_together = (('project', 'key', 'value'),)

    __repr__ = sane_repr('project_id', 'key', 'value')
