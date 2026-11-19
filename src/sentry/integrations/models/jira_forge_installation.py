from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, control_silo_model
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug


@control_silo_model
class JiraForgeInstallation(DefaultFieldsModel):
    """
    A Forge app's installation on a Jira site, and the integration it belongs to.

    Forge identifies a site by installation and cloud ID, but integrations created by the
    Connect app are keyed by Connect clientKey, which Atlassian stops serving at Connect end
    of support. Forge requests find their integration here instead. The system token itself
    stays encrypted in the integration's metadata; only its expiry is kept here.
    """

    __relocation_scope__ = RelocationScope.Excluded

    integration = FlexibleForeignKey("sentry.Integration", on_delete=models.CASCADE)
    installation_id = models.CharField(max_length=255, unique=True)
    cloud_id = models.CharField(max_length=64, db_index=True)
    app_id = models.CharField(max_length=255)
    system_token_expires_at = models.DateTimeField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_jiraforgeinstallation"


def get_forge_installation_integration(
    *, installation_id: str, cloud_id: str
) -> Integration | None:
    """
    The active Jira integration a Forge installation belongs to. Works for sites that moved
    from Connect, whose integrations are keyed by Connect clientKey rather than cloud ID.
    """
    try:
        installation = JiraForgeInstallation.objects.select_related("integration").get(
            installation_id=installation_id,
            cloud_id=cloud_id,
            integration__provider=IntegrationProviderSlug.JIRA.value,
            integration__status=ObjectStatus.ACTIVE,
        )
    except JiraForgeInstallation.DoesNotExist:
        return None
    return installation.integration
