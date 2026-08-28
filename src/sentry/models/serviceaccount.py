from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@control_silo_model
class ServiceAccount(DefaultFieldsModel):
    """An organization-owned, non-human actor.

    Authorization is intentionally not stored here. A service account receives the
    same organization role and team memberships as a user through
    ``OrganizationMember`` and is narrowed by ordinary ``ApiToken`` scopes.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization_id = HybridCloudForeignKey("sentry.Organization", null=False, on_delete="CASCADE")
    name = models.CharField(max_length=256)
    is_active = models.BooleanField(default=True, db_default=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_serviceaccount"
        constraints = [
            models.UniqueConstraint(
                fields=("organization_id", "name"),
                name="sentry_serviceaccount_org_name_unique",
            ),
        ]

    __repr__ = sane_repr("organization_id", "name", "is_active")
