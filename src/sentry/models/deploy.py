"""
sentry.models.deploy
~~~~~~~~~~~~~~~~~~~~
"""

from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model
)


class Deploy(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    release = FlexibleForeignKey('sentry.Release')
    environment_id = BoundedPositiveIntegerField(db_index=True)
    date_finished = models.DateTimeField(default=timezone.now)
    date_started = models.DateTimeField(null=True, blank=True)
    name = models.CharField(max_length=64, null=True, blank=True)
    url = models.URLField(null=True, blank=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_deploy'
