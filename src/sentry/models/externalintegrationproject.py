from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, Model
)


class ExternalProjectIntegration(Model):
    __core__ = False

    organization_integration_id = BoundedPositiveIntegerField(db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
    name = models.CharField(max_length=128)
    external_id = models.CharField(max_length=64)
    resolved_status = models.CharField(max_length=64)
    unresolved_status = models.CharField(max_length=64)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_externalprojectintegration'
        unique_together = (('organization_integration_id', 'external_id'),)
