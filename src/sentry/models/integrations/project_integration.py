from sentry.db.models import FlexibleForeignKey, Model
from sentry.db.models.fields.jsonfield import JSONField


class ProjectIntegration(Model):
    """
    TODO(epurkhiser): This is deprecated and will be removed soon. Do not use
     Project Integrations.
    """

    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project")
    integration = FlexibleForeignKey("sentry.Integration")
    config = JSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectintegration"
        unique_together = (("project", "integration"),)
