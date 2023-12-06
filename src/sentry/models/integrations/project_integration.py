from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField


@region_silo_only_model
class ProjectIntegration(Model):
    """
    TODO(epurkhiser): This is deprecated and will be removed soon. Do not use
     Project Integrations.
    """

    __relocation_scope__ = RelocationScope.Global

    project = FlexibleForeignKey("sentry.Project")
    integration_id = HybridCloudForeignKey("sentry.Integration", on_delete="CASCADE")
    config = JSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectintegration"
        unique_together = (("project", "integration_id"),)
