from django.db import models
from django.utils import timezone

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey


class PagerDutyService(DefaultFieldsModel):
    __include_in_export__ = False

    organization_integration = FlexibleForeignKey("sentry.OrganizationIntegration")
    integration_key = models.CharField(max_length=255)
    service_name = models.CharField(max_length=255)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pagerdutyservice"
