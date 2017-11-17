"""
sentry.tagstore.legacy.models.eventtag
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (Model, BoundedBigIntegerField, sane_repr)


class EventTag(Model):
    __core__ = False

    project_id = BoundedBigIntegerField()
    group_id = BoundedBigIntegerField(null=True)
    event_id = BoundedBigIntegerField()
    # We want to keep this model lightweight, so lets use a pointer to
    # TagKey/TagValue
    key_id = BoundedBigIntegerField()
    value_id = BoundedBigIntegerField()
    # maintain a date column for easy removal
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventtag'
        unique_together = (('event_id', 'key_id', 'value_id'), )
        index_together = (('group_id', 'key_id', 'value_id'), )

    __repr__ = sane_repr('event_id', 'key_id', 'value_id')
