"""
sentry.models.broadcast
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from datetime import timedelta
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr


class Broadcast(Model):
    __core__ = False

    upstream_id = models.CharField(max_length=32, null=True, blank=True)
    title = models.CharField(max_length=32)
    message = models.CharField(max_length=256)
    link = models.URLField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    date_expires = models.DateTimeField(
        default=lambda: timezone.now() + timedelta(days=7),
        null=True,
        blank=True,
    )
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_broadcast'

    __repr__ = sane_repr('message')


class BroadcastSeen(Model):
    __core__ = False

    broadcast = FlexibleForeignKey('sentry.Broadcast')
    user = FlexibleForeignKey('sentry.User')
    date_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_broadcastseen'
        unique_together = (('broadcast', 'user'))

    __repr__ = sane_repr('broadcast', 'user', 'date_seen')
