from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedPositiveIntegerField, Model, control_silo_only_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@control_silo_only_model
class TeamReplica(Model):
    __relocation_scope__ = RelocationScope.Excluded

    team_id = HybridCloudForeignKey("sentry.Team", on_delete="CASCADE")
    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")
    slug = models.SlugField()
    name = models.CharField(max_length=64)
    status = BoundedPositiveIntegerField()
    date_added = models.DateTimeField(default=timezone.now)
    org_role = models.CharField(max_length=32, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_teamreplica"
        unique_together = (("organization_id", "slug"),)

    __repr__ = sane_repr("name", "slug")

    def get_audit_log_data(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "status": self.status,
            "org_role": self.org_role,
        }
