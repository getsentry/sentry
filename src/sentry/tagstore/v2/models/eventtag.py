"""
sentry.tagstore.v2.models.eventtag
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (Model, BoundedPositiveIntegerField, FlexibleForeignKey, sane_repr)


class EventTag(Model):
    __core__ = False

    project_id = BoundedPositiveIntegerField()
    group_id = BoundedPositiveIntegerField()
    event_id = BoundedPositiveIntegerField()
    key = FlexibleForeignKey('tagstore.TagKey', db_column='key_id')
    value = FlexibleForeignKey('tagstore.TagValue', db_column='value_id')
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', 'event_id', 'key', 'value'), )
        index_together = (
            ('project_id', 'key', 'value'),
            ('group_id', 'key', 'value'),
        )

    __repr__ = sane_repr('event_id', 'key', 'value')
