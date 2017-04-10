from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField, BoundedPositiveIntegerField, Model, sane_repr
)


class EventUserLocation(Model):
    """
    Every location that an issue has been seen when it's associated with
    an EventUser.
    """
    __core__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    event_user_id = BoundedBigIntegerField()
    city_id = BoundedBigIntegerField()
    times_seen = BoundedPositiveIntegerField(default=0)
    last_seen = models.DateTimeField(default=timezone.now)
    first_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventuserlocation'
        unique_together = ('event_user_id', 'city_id')

    __repr__ = sane_repr('event_user_id', 'city_id')
