"""
sentry.models.broadcast
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import Model, sane_repr


BADGES = (
    ('new', 'new'),
    ('tip', 'tip'),
)


class Broadcast(Model):
    message = models.CharField(max_length=256)
    link = models.URLField(null=True, blank=True)
    badge = models.CharField(max_length=32, choices=BADGES, null=True,
                             blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_broadcast'

    __repr__ = sane_repr('message')
