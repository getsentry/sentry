from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import Model, BoundedPositiveIntegerField


class Suspension(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(null=True, unique=True)
    owner_id = BoundedPositiveIntegerField(null=True)
    owner_email = models.TextField(null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_suspension'
