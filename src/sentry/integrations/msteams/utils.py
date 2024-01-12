from __future__ import annotations

import enum
import logging

from sentry.incidents.models import AlertRuleTriggerAction, Incident, IncidentStatus
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.integration import integration_service

from .client import MsTeamsClient, MsTeamsPreInstallClient, get_token_data

MSTEAMS_MAX_ITERS = 100

logger = logging.getLogger("sentry.integrations.msteams")


# MS Teams will convert integers into strings in value inputs sent in adaptive
# cards, may as well just do that here first.
class ACTION_TYPE(str, enum.Enum):
    RESOLVE = "1"
    IGNORE = "2"
    ASSIGN = "3"
    UNRESOLVE = "4"
    UNASSIGN = "5"


def channel_filter(channel, name):
    # the general channel has no name in the list
    # retrieved from the REST API call
    if channel.get("name"):
        return name.lower() == channel.get("name").lower()
    else:
        return name.lower() == "general"


def get_user_conversation_id(integration: Integration, user_id: str) -> str:
    """
    Get the user_conversation_id even if `integration.metadata.tenant_id` is not set.
    """
    client = MsTeamsClient(integration)

    tenant_id = integration.metadata.get("tenant_id")

    if not tenant_id:
        # This is definitely an integration of `integration.metadata.installation_type` == `team`,
        # so use the `integration.external_id` (team_id) to get the tenant_id.
        members = client.get_member_list(integration.external_id).get("members")
        tenant_id = members[0].get("tenantId")

    conversation_id = client.get_user_conversation_id(user_id, tenant_id)

    return conversation_id


def get_channel_id(organization, integration_id, name):
    integrations = integration_service.get_integrations(
        providers=["msteams"],
        organization_id=organization.id,
        integration_ids=[integration_id],
    )
    if not integrations:
        return None

    assert len(integrations) == 1, "Found multiple msteams integrations for org!"
    integration = integrations[0]

    team_id = integration.external_id
    client = MsTeamsClient(integration)

    # handle searching for channels first
    channel_list = client.get_channel_list(team_id)
    filtered_channels = list(filter(lambda x: channel_filter(x, name), channel_list))
    if len(filtered_channels) > 0:
        return filtered_channels[0].get("id")

    # handle searching for users
    members = client.get_member_list(team_id, None)
    for i in range(MSTEAMS_MAX_ITERS):
        member_list = members.get("members")
        continuation_token = members.get("continuationToken")

        filtered_members = list(
            filter(lambda x: x.get("name").lower() == name.lower(), member_list)
        )
        if len(filtered_members) > 0:
            # TODO: handle duplicate username case
            user_id = filtered_members[0].get("id")
            tenant_id = filtered_members[0].get("tenantId")
            return client.get_user_conversation_id(user_id, tenant_id)

        if not continuation_token:
            return None

        members = client.get_member_list(team_id, continuation_token)

    return None


def send_incident_alert_notification(
    action: AlertRuleTriggerAction,
    incident: Incident,
    metric_value: float | None,
    new_status: IncidentStatus,
    notification_uuid: str | None = None,
) -> bool:
    from .card_builder.incident_attachment import build_incident_attachment

    if action.target_identifier is None:
        raise ValueError("Can't send without `target_identifier`")

    attachment = build_incident_attachment(incident, new_status, metric_value, notification_uuid)
    success = integration_service.send_msteams_incident_alert_notification(
        integration_id=action.integration_id,
        channel=action.target_identifier,
        attachment=attachment,
    )
    return success


def get_preinstall_client(service_url):
    # may want try/catch here since this makes an external API call
    access_token = get_token_data()["access_token"]
    return MsTeamsPreInstallClient(access_token, service_url)
