from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class RollbackOrganizationData(DefaultFieldsModel):
    """
    A model for storing organization data by year for rollback purposes
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")
    year = models.IntegerField()
    data = models.JSONField(null=True, default=None)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rollbackorganizationdata"

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "year"],
                name="sentry_rollbackorganizationdata_unique_org_year",
            )
        ]
