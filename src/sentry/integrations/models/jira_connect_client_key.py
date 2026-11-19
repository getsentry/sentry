from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, control_silo_model
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug


@control_silo_model
class JiraConnectClientKey(DefaultFieldsModel):
    """
    The Connect clientKey of a Jira integration. Temporary: Jira integrations are being
    rekeyed from clientKey to cloud ID, and Connect requests still name their site by
    clientKey (the JWT `iss`), so they find a rekeyed integration here. Remove it once
    Connect traffic reaches zero.
    """

    __relocation_scope__ = RelocationScope.Excluded

    client_key = models.CharField(max_length=256, unique=True)
    integration = FlexibleForeignKey("sentry.Integration", on_delete=models.CASCADE)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_jiraconnectclientkey"


def get_jira_integration_by_client_key(client_key: str) -> Integration | None:
    """The Jira integration for a Connect clientKey, whether or not it has been rekeyed."""
    integration = Integration.objects.get_or_none(
        provider=IntegrationProviderSlug.JIRA.value, external_id=client_key
    )
    if integration is not None:
        return integration
    try:
        return (
            JiraConnectClientKey.objects.select_related("integration")
            .get(client_key=client_key)
            .integration
        )
    except JiraConnectClientKey.DoesNotExist:
        return None
