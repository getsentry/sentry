from __future__ import annotations

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.integrations.api.bases.organization_integrations import (
    RegionOrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.msteams.client import MsTeamsClient
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import ApiError


def _slack_list_channels(*, integration_id: int) -> list[dict[str, Any]]:
    """
    List Slack channels for a given integration.

    NOTE: We are NOT using pagination here because some organizations have
    more than 1000 channels. Searching client-side might miss channels beyond
    the first 1000, so we fetch the maximum allowed by Slack and rely on
    validation when saving.
    """

    from sentry.integrations.slack.sdk_client import SlackSdkClient

    client = SlackSdkClient(integration_id=integration_id)
    resp = client.conversations_list(
        exclude_archived=True,
        types="public_channel,private_channel",
        limit=1000,  # Max Slack allows (see https://docs.slack.dev/reference/methods/conversations.list/)
    ).data

    resp_data: dict[str, Any] = resp if isinstance(resp, dict) else {}
    channels = resp_data.get("channels", []) or []

    results: list[dict[str, Any]] = []
    for ch in channels:
        name = ch.get("name")
        results.append(
            {
                "id": ch.get("id"),
                "name": name,
                "display": f"#{name}",
                "type": "private" if bool(ch.get("is_private")) else "public",
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
    channels = (
        client.get(f"/guilds/{guild_id}/channels", headers=client.prepare_auth_header()) or []
    )

    selectable_types = DISCORD_CHANNEL_TYPES.keys()
    filtered = [ch for ch in channels if ch.get("type") in selectable_types]

    results: list[dict[str, Any]] = []
    for ch in filtered:
        results.append(
            {
                "id": ch["id"],
                "name": ch["name"],
                "display": f"#{ch['name']}",
                "type": DISCORD_CHANNEL_TYPES.get(ch["type"], "unknown"),
            }
        )

    return results


def _msteams_list_channels(*, integration_id: int, team_id: str) -> list[dict[str, Any]]:
    """
    List Microsoft Teams channels for a team.

    The Teams API returns all channels at once.
    Only standard and private channels are included.
    """

    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        raise ApiError("Microsoft Teams integration not found")

    client = MsTeamsClient(integration)
    channels_resp = client.get(client.CHANNEL_URL % team_id) or {}
    channels = channels_resp.get("conversations") or []

    results: list[dict[str, Any]] = []
    for ch in channels:
        results.append(
            {
                "id": ch["id"],
                "name": ch["displayName"],
                "display": ch["displayName"],
                "type": ch.get("membershipType", "standard"),  # "standard" or "private"
            }
        )

    return results


class OrganizationIntegrationChannelsEndpoint(RegionOrganizationIntegrationBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def get(
        self,
        request: Request,
        organization: Organization,
        integration_id: int,
        **kwargs: Any,
    ) -> Response:
        """
        List all messaging channels for an integration.
        """

        integration = self.get_integration(organization.id, integration_id)

        try:
            match integration.provider:
                case IntegrationProviderSlug.SLACK.value:
                    results = _slack_list_channels(integration_id=integration.id)
                case IntegrationProviderSlug.DISCORD.value:
                    results = _discord_list_channels(guild_id=str(integration.external_id))
                case IntegrationProviderSlug.MSTEAMS.value:
                    results = _msteams_list_channels(
                        integration_id=integration.id,
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
