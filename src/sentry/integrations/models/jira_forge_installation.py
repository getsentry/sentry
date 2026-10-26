from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, control_silo_model


@control_silo_model
class JiraForgeInstallation(DefaultFieldsModel):
    """
    Links a Jira Cloud integration to its site's Forge identity.

    Forge requests identify a site by its cloud ID rather than the Connect
    clientKey that `Integration.external_id` holds, and `Integration.metadata`
    is encrypted, so this table is how a Forge request finds its integration.
    """

    __relocation_scope__ = RelocationScope.Excluded

    integration = FlexibleForeignKey("sentry.Integration", on_delete=models.CASCADE, unique=True)
    cloud_id = models.CharField(max_length=64, unique=True)
    # Null until the site sends its first Forge request, since a cloud ID can be
    # backfilled from the site URL alone. Changes if the app is reinstalled.
    installation_id = models.CharField(max_length=256, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_jiraforgeinstallation"
