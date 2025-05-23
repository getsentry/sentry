from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    ArrayField,
    DefaultFieldsModelExisting,
    FlexibleForeignKey,
    region_silo_model,
)


@region_silo_model
class DataSecrecyWaiver(DefaultFieldsModelExisting):
    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization", unique=True)
    access_start = models.DateTimeField(default=timezone.now)
    access_end = models.DateTimeField(default=timezone.now)
    zendesk_tickets = ArrayField(models.URLField(max_length=255), default=list)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_datasecrecywaiver"
