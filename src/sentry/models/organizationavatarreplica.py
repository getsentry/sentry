from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@control_silo_model
class OrganizationAvatarReplica(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE", unique=True)
    avatar_type = models.PositiveSmallIntegerField(default=0)
    avatar_ident = models.CharField(max_length=32)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationavatarreplica"

    __repr__ = sane_repr("organization_id", "avatar_type")
