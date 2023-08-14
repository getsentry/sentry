from __future__ import annotations

from django.db import models
from django.db.models import CASCADE
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, Model
from sentry.db.models.base import control_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.integrations.organization_integration import PagerDutyServiceDict


@control_silo_only_model
class PagerDutyService(Model):
    """
    Deprecated model -- this configuration now exists inside of the OrganizationIntegration.config value.
    """

    __include_in_export__ = False

    organization_integration = FlexibleForeignKey(
        "sentry.OrganizationIntegration", on_delete=CASCADE, db_constraint=False
    )

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="cascade")

    # From a region point of view, you really only have per organization scoping.
    integration_id = BoundedBigIntegerField(db_index=False)
    integration_key = models.CharField(max_length=255)
    service_name = models.CharField(max_length=255)
    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pagerdutyservice"

    def as_dict(self) -> PagerDutyServiceDict:
        return dict(
            integration_id=self.integration_id,
            integration_key=self.integration_key,
            service_name=self.service_name,
            id=self.id,
        )
