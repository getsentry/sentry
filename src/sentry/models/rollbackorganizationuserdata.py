import uuid

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


def default_uuid():
    return str(uuid.uuid4())


@region_silo_model
class RollbackOrganizationUserData(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    data = models.JSONField(null=True, default=None)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rollbackorganizationuserdata"

        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "organization"],
                name="sentry_rollbackorganizationuserdata_unique_user_org",
            )
        ]
