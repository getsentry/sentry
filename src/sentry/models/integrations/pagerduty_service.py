from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_only_model,
)
from sentry.models.integrations.organization_integrity_backfill_mixin import (
    OrganizationIntegrityBackfillMixin,
)


@region_silo_only_model
class PagerDutyService(DefaultFieldsModel, OrganizationIntegrityBackfillMixin):
    __include_in_export__ = False

    organization_integration = FlexibleForeignKey("sentry.OrganizationIntegration")
    organization_id = BoundedBigIntegerField(null=False, db_index=True)
    # From a region point of view, you really only have per organization scoping.
    integration_id = BoundedBigIntegerField(null=False, db_index=False)
    integration_key = models.CharField(max_length=255)
    service_name = models.CharField(max_length=255)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pagerdutyservice"
