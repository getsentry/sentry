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
    environment_id = BoundedPositiveIntegerField()
    group_id = BoundedPositiveIntegerField()
    event_id = BoundedPositiveIntegerField()
    _key = FlexibleForeignKey('tagstore.TagKey', db_column='key')
    _value = FlexibleForeignKey('tagstore.TagValue', db_column='value')
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'tagstore'
        unique_together = (('event_id', '_key', '_value'), )
        index_together = (
            ('project_id', '_key', '_value'),
            ('group_id', '_key', '_value'),
            ('environment_id', '_key', '_value'),
        )

    __repr__ = sane_repr('event_id', '_key', '_value')

    @property
    def key(self):
        return self._key.key

    @property
    def value(self):
        return self._value.value
