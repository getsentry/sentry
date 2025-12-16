from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedIntegerField, FlexibleForeignKey, region_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD = 2


@region_silo_model
class OrganizationContributors(DefaultFieldsModel):
    """
    Tracks external contributors and their activity for an organization.
    This model stores information about contributors associated with an
    integration for a specific organization, including their external identity
    and how many actions they have taken.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)

    integration_id = HybridCloudForeignKey("sentry.Integration", on_delete="DO_NOTHING")

    external_identifier = models.CharField(max_length=255, db_index=True)
    alias = models.CharField(max_length=255, null=True, blank=True)
    num_actions = BoundedIntegerField(default=0)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationcontributors"
        constraints = [
            models.UniqueConstraint(
                fields=["organization_id", "integration_id", "external_identifier"],
                name="sentry_orgcont_unique_org_cont",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization_id", "date_updated"],
                name="sentry_oc_org_date_upd_idx",
            ),
        ]
