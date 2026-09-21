from collections.abc import Mapping
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.utils.safe import get_path


def get_integration_from_channel_data(data: Mapping[str, Any]) -> RpcIntegration | None:
    team_id = get_path(data, "channelData", "team", "id")
    if team_id is None:
        return None
    return integration_service.get_integration(
        provider=IntegrationProviderSlug.MSTEAMS.value,
        external_id=team_id,
        status=ObjectStatus.ACTIVE,
    )


def _integration_lookups(data: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """
    The `integration_service.get_integration` filters that could identify the integration a
    request belongs to, most specific first. Empty when the request carries no usable identifier.
    """
    lookups: list[Mapping[str, Any]] = []

    # The bot embeds an "integrationId" in the card action context of the cards it builds, and
    # Teams echoes that context back when a user interacts with the card. Cards built by the
    # notification platform omit it, since the renderer has no access to the target it is being
    # sent to, leaving only the conversation the request arrived on to identify the integration.
    #
    # See: https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-actions?tabs=json#actionsubmit
    integration_id = get_path(data, "value", "payload", "integrationId")
    if integration_id is not None:
        lookups.append({"integration_id": integration_id})

    # Team installs are keyed by team id, personal installs by tenant id.
    for external_id in (
        get_path(data, "channelData", "team", "id"),
        get_path(data, "channelData", "tenant", "id"),
    ):
        if external_id is not None:
            lookups.append(
                {"provider": IntegrationProviderSlug.MSTEAMS.value, "external_id": external_id}
            )

    return lookups


def can_infer_integration(data: Mapping[str, Any]) -> bool:
    return len(_integration_lookups(data=data)) > 0


def get_integration_from_request_data(data: Mapping[str, Any]) -> RpcIntegration | None:
    for lookup in _integration_lookups(data=data):
        integration = integration_service.get_integration(
            status=ObjectStatus.ACTIVE,
            **lookup,
        )
        if integration is not None:
            return integration
    return None


def is_new_integration_installation_event(data: Mapping[str, Any]) -> bool:
    from sentry.integrations.msteams.webhook import MsTeamsEvents

    try:
        raw_event_type = data["type"]
        event_type = MsTeamsEvents.get_from_value(value=raw_event_type)
        if event_type != MsTeamsEvents.INSTALLATION_UPDATE:
            return False

        action = data.get("action", None)
        if action is None or action != "add":
            return False

        return True
    except Exception:
        return False
