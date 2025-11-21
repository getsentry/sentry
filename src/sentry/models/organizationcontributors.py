from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedIntegerField, FlexibleForeignKey, Model, region_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@region_silo_model
class OrganizationContributors(Model):
    """
    Tracks external contributors and their activity for an organization.
    This model stores information about contributors associated with an
    integration for a specific organization, including their external identity
    and how many actions they have taken.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)

    integration_id = HybridCloudForeignKey("sentry.Integration", on_delete="CASCADE")

    external_identifier = models.CharField(max_length=255)
    alias = models.CharField(max_length=255, null=True, blank=True)
    num_actions = BoundedIntegerField(default=0)
    date_added = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationcontributors"
        constraints = [
            models.UniqueConstraint(
                fields=["organization_id", "integration_id", "external_identifier"],
                name="sentry_organizationcontributors_unique_org_contributor",
            ),
        ]
        indexes = [
            models.Index(fields=["date_updated"]),
        ]
