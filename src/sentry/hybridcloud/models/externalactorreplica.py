from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    control_silo_only_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@control_silo_only_model
class ExternalActorReplica(Model):
    __relocation_scope__ = RelocationScope.Excluded

    externalactor_id = BoundedPositiveIntegerField()
    team_id = HybridCloudForeignKey("sentry.Team", null=True, db_index=True, on_delete="CASCADE")
    user = FlexibleForeignKey("sentry.User", null=True, db_index=True, on_delete=models.CASCADE)
    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")
    integration = FlexibleForeignKey("sentry.Integration", on_delete=models.CASCADE)

    provider = BoundedPositiveIntegerField()

    # The display name i.e. username, team name, channel name.
    external_name = models.TextField()
    # The unique identifier i.e user ID, channel ID.
    external_id = models.TextField(null=True)

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_externalactorreplica"
        unique_together = (
            ("organization_id", "provider", "external_name", "team_id"),
            ("organization_id", "provider", "external_name", "user_id"),
        )
