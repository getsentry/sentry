import logging
from collections.abc import Mapping
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug

logger = logging.getLogger(__name__)


def _infer_team_id_from_channel_data(data: Mapping[str, Any]) -> str | None:
    try:
        channel_data = data["channelData"]
        team_id = channel_data["team"]["id"]
        return team_id
    except Exception:
        pass
    return None


def get_integration_from_channel_data(data: Mapping[str, Any]) -> RpcIntegration | None:
    team_id = _infer_team_id_from_channel_data(data=data)
    if team_id is None:
        return None
    return integration_service.get_integration(
        provider=IntegrationProviderSlug.MSTEAMS.value,
        external_id=team_id,
        status=ObjectStatus.ACTIVE,
    )


def get_integration_for_tenant(data: Mapping[str, Any]) -> RpcIntegration | None:
    try:
        channel_data = data["channelData"]
        tenant_id = channel_data["tenant"]["id"]
        return integration_service.get_integration(
            provider=IntegrationProviderSlug.MSTEAMS.value,
            external_id=tenant_id,
            status=ObjectStatus.ACTIVE,
        )
    except Exception as err:
        logger.info("failed to get tenant id from request data", exc_info=err, extra={"data": data})
    return None


def _infer_integration_id_from_card_action(data: Mapping[str, Any]) -> int | None:
    # The bot builds and sends Adaptive Cards to the channel, and in it will include card actions and context.
    # The context will include the "integrationId".
    # Whenever a user interacts with the card, MS Teams will send the card action and the context to the bot.
    # Here we parse the "integrationId" from the context.
    #
    # See: https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-actions?tabs=json#actionsubmit
    try:
        payload = data["value"]["payload"]
        integration_id = payload["integrationId"]
        return integration_id
    except Exception:
        pass
    return None


def get_integration_from_card_action(data: Mapping[str, Any]) -> RpcIntegration | None:
    integration_id = _infer_integration_id_from_card_action(data=data)
    if integration_id is None:
        return None
    return integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.ACTIVE
    )


def can_infer_integration(data: Mapping[str, Any]) -> bool:
    return (
        _infer_integration_id_from_card_action(data=data) is not None
        or _infer_team_id_from_channel_data(data=data) is not None
    )


def is_new_integration_installation_event(data: Mapping[str, Any]) -> bool:
    from sentry.integrations.msteams.webhook import MsTeamsEvents

    try:
        raw_event_type = data["type"]
        event_type = MsTeamsEvents.get_from_value(value=raw_event_type)

        if event_type == MsTeamsEvents.INSTALLATION_UPDATE:
            action = data.get("action", None)
            return action is not None and action == "add"

        if event_type == MsTeamsEvents.CONVERSATION_UPDATE:
            # A conversationUpdate with teamMemberAdded is the older mechanism
            # by which MS Teams notifies a bot that it has been added to a team.
            # There is no integration record yet, so we must handle this in the
            # control silo just like an installationUpdate "add" event.
            channel_data = data.get("channelData", {})
            if channel_data.get("eventType") == "teamMemberAdded":
                return True

            # A personal (1:1) installation also arrives as a conversationUpdate
            # with a membersAdded list and conversationType "personal".
            conversation = data.get("conversation", {})
            if data.get("membersAdded") and conversation.get("conversationType") == "personal":
                return True

        return False
    except Exception:
        return False
