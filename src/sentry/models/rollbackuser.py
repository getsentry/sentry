from uuid import uuid4

from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_model
class RollbackUser(DefaultFieldsModel):
    """
    Stores a summary of every organization member's year-in-review information to power the 2024 Sentry Rollback.
    """

    __relocation_scope__ = RelocationScope.Excluded

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    uuid = models.UUIDField(default=uuid4, unique=True, editable=False)
    share_uuid = models.UUIDField(default=uuid4, unique=True, editable=False)
    data = models.JSONField(null=True, default=None)
    share_data = models.JSONField(null=True, default=None)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rollbackuser"
        constraints = [
            UniqueConstraint(fields=["user_id", "organization_id"], name="unique_user_org"),
        ]
