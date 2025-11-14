from __future__ import annotations

import logging
from typing import int, Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.api.bases.organization_integrations import (
    OrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.models import Integration
from sentry.integrations.msteams.client import MsTeamsClient
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization import RpcUserOrganizationContext
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


def _slack_list_channels(*, integration_id: int) -> list[dict[str, Any]]:
    """
    List Slack channels for a given integration.

    Fetches up to the Slack API limit (1000 channels).
    Handles authentication via integration context and validates responses.
    """

    from sentry.integrations.slack.sdk_client import SlackSdkClient

    client = SlackSdkClient(integration_id=integration_id)

    try:
        response = client.conversations_list(
            exclude_archived=True,
            types="public_channel,private_channel",
            limit=1000,  # Max allowed by Slack API
        )
        resp_data: dict[str, Any] = response.data if isinstance(response.data, dict) else {}
    except Exception as e:
        logger.warning("Slack API request failed for integration_id=%s: %s", integration_id, e)
        return []

    # Validate structure
    raw_channels = resp_data.get("channels")
    if not isinstance(raw_channels, list):
        logger.warning(
            "Unexpected Slack API response structure for integration_id=%s: %r",
            integration_id,
            resp_data,
        )
        return []

    results: list[dict[str, Any]] = []
    for ch in raw_channels:
        if not isinstance(ch, dict):
            continue

        ch_id = ch.get("id")
        ch_name = ch.get("name")
        if not ch_id or not ch_name:
            continue

        is_private = bool(ch.get("is_private"))
        name_str = str(ch_name)

        results.append(
            {
                "id": str(ch_id),
                "name": name_str,
                "display": f"#{name_str}",
                "type": "private" if is_private else "public",
            }
        )

    return results


def _discord_list_channels(*, guild_id: str) -> list[dict[str, Any]]:
    """
    List Discord channels for a given guild that can receive messages.

    The Discord API returns all guild channels in a single call.
    This function filters for messageable channels only.
    """

    DISCORD_CHANNEL_TYPES = {
        0: "text",
        5: "announcement",
        15: "forum",
    }

    client = DiscordClient()

    try:
        raw_resp = client.get(
            f"/guilds/{guild_id}/channels",
            headers=client.prepare_auth_header(),
        )
    except Exception as e:
        logger.warning(
            "Discord API request failed for guild_id=%s: %s",
            guild_id,
            e,
        )
        return []

    if not isinstance(raw_resp, list):
        logger.warning(
            "Unexpected Discord API response for guild_id=%s: %r",
            guild_id,
            raw_resp,
        )
        return []

    selectable_types = set(DISCORD_CHANNEL_TYPES.keys())
    results: list[dict[str, Any]] = []

    for item in raw_resp:
        if not isinstance(item, dict):
            continue

        ch_type = item.get("type")
        if not isinstance(ch_type, int) or ch_type not in selectable_types:
            continue

        ch_id = item.get("id")
        ch_name = item.get("name")
        if not ch_id or not ch_name:
            continue

        results.append(
            {
                "id": str(ch_id),
                "name": str(ch_name),
                "display": f"#{ch_name}",
                "type": DISCORD_CHANNEL_TYPES.get(ch_type, "unknown"),
            }
        )

    return results


def _msteams_list_channels(
    *, integration: Integration | RpcIntegration, team_id: str
) -> list[dict[str, Any]]:
    """
    List Microsoft Teams channels for a given team.

    The Teams API returns all channels at once.
    Only standard and private channels are included.
    """

    client = MsTeamsClient(integration)

    try:
        raw_resp = client.get(client.CHANNEL_URL % team_id)
    except Exception as e:
        logger.warning(
            "Microsoft Teams API request failed for integration_id=%s, team_id=%s: %s",
            integration.id,
            team_id,
            e,
        )
        return []

    if not isinstance(raw_resp, dict):
        logger.warning(
            "Unexpected Microsoft Teams API response for integration_id=%s, team_id=%s: %r",
            integration.id,
            team_id,
            raw_resp,
        )
        return []

    raw_channels = raw_resp.get("conversations")
    if not isinstance(raw_channels, list):
        logger.warning(
            "Missing or invalid 'conversations' in Teams API response for integration_id=%s, team_id=%s: %r",
            integration.id,
            team_id,
            raw_resp,
        )
        return []

    results: list[dict[str, Any]] = []
    for item in raw_channels:
        if not isinstance(item, dict):
            continue

        ch_id = item.get("id")
        display_name = item.get("displayName")
        if not ch_id or not display_name:
            continue

        ch_type = str(item.get("membershipType") or "standard")

        results.append(
            {
                "id": str(ch_id),
                "name": str(display_name),
                "display": str(display_name),
                "type": ch_type,  # "standard" or "private"
            }
        )

    return results


@control_silo_endpoint
class OrganizationIntegrationChannelsEndpoint(OrganizationIntegrationBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        integration_id: int,
        **kwargs: Any,
    ) -> Response:
        """
        List all messaging channels for an integration.
        """

        integration = self.get_integration(organization_context.organization.id, integration_id)

        try:
            match integration.provider:
                case IntegrationProviderSlug.SLACK.value:
                    results = _slack_list_channels(integration_id=integration.id)
                case IntegrationProviderSlug.DISCORD.value:
                    results = _discord_list_channels(guild_id=str(integration.external_id))
                case IntegrationProviderSlug.MSTEAMS.value:
                    results = _msteams_list_channels(
                        integration=integration,
                        team_id=str(integration.external_id),
                    )
                case _:
                    return self.respond(
                        {
                            "results": [],
                            "warning": f"Channel listing not supported for provider '{integration.provider}'.",
                        }
                    )
        except ApiError as e:
            return self.respond({"detail": str(e)}, status=400)

        return self.respond({"results": results})
