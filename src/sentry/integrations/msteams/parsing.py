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


def _external_id_lookup(external_id: str) -> Mapping[str, Any]:
    return {"provider": IntegrationProviderSlug.MSTEAMS.value, "external_id": external_id}


def _routable_lookups(data: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """
    The `integration_service.get_integration` filters identifying an integration whose events
    are served from the cells, most specific first.
    """
    lookups: list[Mapping[str, Any]] = []

    # The bot embeds an "integrationId" in the card action context of the cards it sends, and
    # Teams echoes that context back when a user interacts with the card.
    #
    # See: https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-actions?tabs=json#actionsubmit
    integration_id = get_path(data, "value", "payload", "integrationId")
    if integration_id is not None:
        lookups.append({"integration_id": integration_id})

    team_id = get_path(data, "channelData", "team", "id")
    if team_id is not None:
        lookups.append(_external_id_lookup(team_id))

    return lookups


def _integration_lookups(data: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """
    The `integration_service.get_integration` filters that could identify the integration a
    request belongs to, most specific first. Empty when the request carries no usable identifier.
    """
    lookups = _routable_lookups(data=data)

    # Personal installs are keyed by tenant id. Their events are handled in the control silo,
    # where the identities they operate on live, so a tenant id is not routable on its own.
    tenant_id = get_path(data, "channelData", "tenant", "id")
    if tenant_id is not None:
        lookups.append(_external_id_lookup(tenant_id))

    return lookups


def can_infer_integration(data: Mapping[str, Any]) -> bool:
    return len(_routable_lookups(data=data)) > 0


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
