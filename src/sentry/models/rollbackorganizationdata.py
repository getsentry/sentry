from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModelExisting, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class RollbackOrganizationData(DefaultFieldsModelExisting):
    """
    A model for storing organization data by year for rollback purposes
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization")
    data = models.JSONField(null=True, default=None)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rollbackorganizationdata"
