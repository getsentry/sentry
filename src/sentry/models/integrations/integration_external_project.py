from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedPositiveIntegerField, Model, control_silo_only_model


@control_silo_only_model
class IntegrationExternalProject(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_integration_id = BoundedPositiveIntegerField(db_index=True)
    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    name = models.CharField(max_length=128)
    external_id = models.CharField(max_length=64)
    resolved_status = models.CharField(max_length=64)
    unresolved_status = models.CharField(max_length=64)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integrationexternalproject"
        unique_together = (("organization_integration_id", "external_id"),)
