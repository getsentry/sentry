from django.db import models
from django.db.models import CASCADE
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, DefaultFieldsModel, FlexibleForeignKey
from sentry.db.models.base import ModelSiloLimit
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.silo import SiloMode


# Temporary -- this will become a control silo model again after a future getsentry merge.
@ModelSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class PagerDutyService(DefaultFieldsModel):
    __include_in_export__ = False

    organization_integration = FlexibleForeignKey(
        "sentry.OrganizationIntegration", on_delete=CASCADE, db_constraint=False
    )

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="cascade")

    # From a region point of view, you really only have per organization scoping.
    integration_id = BoundedBigIntegerField(db_index=False)
    integration_key = models.CharField(max_length=255)
    service_name = models.CharField(max_length=255)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pagerdutyservice"
