import uuid

from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModelExisting, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


def default_uuid():
    return str(uuid.uuid4())


@region_silo_model
class RollbackIdentifier(DefaultFieldsModelExisting):
    __relocation_scope__ = RelocationScope.Organization

    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")
    uuid = models.CharField(max_length=64, default=default_uuid)
    share_uuid = models.CharField(max_length=64, default=default_uuid)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_rollbackidentifier"
        constraints = [
            UniqueConstraint(fields=["user_id", "organization_id"], name="unique_user_org"),
            UniqueConstraint(fields=["uuid"], name="unique_uuid"),
            UniqueConstraint(fields=["share_uuid"], name="unique_share_uuid"),
        ]
