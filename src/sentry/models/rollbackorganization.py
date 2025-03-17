from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class RollbackOrganization(DefaultFieldsModel):
    """
    Stores a summary of every organization's year-in-review information to power the 2024 Sentry Rollback.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization")
    data = models.JSONField(null=True, default=None)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rollbackorganization"
        constraints = [
            UniqueConstraint(fields=["organization_id"], name="unique_org"),
        ]
