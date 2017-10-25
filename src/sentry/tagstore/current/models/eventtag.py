"""
sentry.tagstore.current.models.eventtag
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (Model, BoundedPositiveIntegerField, sane_repr)


class EventTag(Model):
    __core__ = False

    # TODO: drop PK in favor of composite PK of (event, key, id)?

    project_id = BoundedPositiveIntegerField()
    group_id = BoundedPositiveIntegerField()
    event_id = BoundedPositiveIntegerField()
    key_id = BoundedPositiveIntegerField()
    value_id = BoundedPositiveIntegerField()
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventtag_current'
        unique_together = (('event_id', 'key_id', 'value_id'), )
        index_together = (
            ('project_id', 'key_id', 'value_id'),
            ('group_id', 'key_id', 'value_id'),
        )

    __repr__ = sane_repr('event_id', 'key_id', 'value_id')
