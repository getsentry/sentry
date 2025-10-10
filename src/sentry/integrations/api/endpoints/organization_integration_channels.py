from __future__ import annotations

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.integrations.api.bases.organization_integrations import (
    RegionOrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.msteams.client import MsTeamsClient
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import ApiError


def _slack_list_channels(
    *, integration_id: int, cursor: str | None, limit: int
) -> tuple[list[dict[str, Any]], str | None]:
    """
    List Slack channels for a given integration.

    The Slack API supports filtering and pagination. This function fetches only
    public and private channels.
    """

    from sentry.integrations.slack.sdk_client import SlackSdkClient

    client = SlackSdkClient(integration_id=integration_id)
    params: dict[str, Any] = {
        "exclude_archived": True,
        "types": "public_channel,private_channel",
        "limit": limit,
    }
    if cursor:
        params["cursor"] = cursor
    resp = client.conversations_list(**params).data
    resp_data: dict[str, Any] = resp if isinstance(resp, dict) else {}
    channels = resp_data.get("channels", []) or []
    next_cursor: str | None = resp_data.get("response_metadata", {}).get("next_cursor")

    results: list[dict[str, Any]] = []
    for ch in channels:

        name = ch.get("name")
        results.append(
            {
                "id": ch.get("id"),
                "name": name,  # 'name' is always present for public and private channels (required by Slack)
                "display": f"#{name}",
                "type": "private" if bool(ch.get("is_private")) else "public",
            }
        )

    return results, next_cursor


def _discord_list_channels(
    *, guild_id: str, cursor: str | None, limit: int
) -> tuple[list[dict[str, Any]], str | None]:
    """
    List Discord channels for a given guild that can receive alert messages.

    The Discord API returns all guild channels in a single call and does not
    support server-side type filtering or pagination. This function filters
    for messageable channels and emulates pagination using a cursor offset.
    The `cursor` parameter represents the starting offset for slicing the channel list.
    """

    DISCORD_CHANNEL_TYPES = {
        0: "text",
        5: "announcement",
        15: "forum",
    }

    client = DiscordClient()

    # Discord API does NOT support server-side type filtering or pagination
    channels = (
        client.get_cached(
            f"/guilds/{guild_id}/channels",
            headers=client.prepare_auth_header(),
            cache_time=60,
        )
        or []
    )

    selectable_types = DISCORD_CHANNEL_TYPES.keys()
    filtered = [ch for ch in channels if ch.get("type") in selectable_types]

    try:
        offset = int(cursor) if cursor else 0
    except ValueError:
        offset = 0

    sliced = filtered[offset : offset + limit]
    next_cursor = str(offset + limit) if (offset + limit) < len(filtered) else None

    results: list[dict[str, Any]] = []
    for ch in sliced:

        results.append(
            {
                "id": ch["id"],
                "name": ch["name"],
                "display": f"#{ch['name']}",
                "type": DISCORD_CHANNEL_TYPES.get(ch["type"], "unknown"),
            }
        )

    return results, next_cursor


def _msteams_list_channels(
    *, integration_id: int, team_id: str, cursor: str | None, limit: int
) -> tuple[list[dict[str, Any]], str | None]:
    """
    List Microsoft Teams channels for a team.

    The Teams API returns all channels at once; this function emulates
    pagination using a simple offset cursor.

    Only standard and private channels are included.
    """

    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        raise ApiError("Microsoft Teams integration not found")

    client = MsTeamsClient(integration)

    # Cache Teams channel list briefly to avoid re-fetching the full list across pages
    channels_resp = client.get_cached(client.CHANNEL_URL % team_id, cache_time=60) or {}
    channels = channels_resp.get("conversations") or []

    try:
        offset = int(cursor) if cursor else 0
    except ValueError:
        offset = 0

    sliced = channels[offset : offset + limit]

    next_cursor = str(offset + limit) if (offset + limit) < len(channels) else None

    results: list[dict[str, Any]] = []
    for ch in sliced:
        results.append(
            {
                "id": ch["id"],
                "name": ch["displayName"],
                "display": ch["displayName"],
                "type": ch.get("membershipType", "standard"),  # "standard" or "private",
            }
        )

    return results, next_cursor


@region_silo_endpoint
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
        List messaging channels with pagination for an messaging integration.

        Query params:
          - query: optional, currently client-side filtered; reserved
          - cursor: provider-specific cursor string (Slack) or integer offset (Discord/Teams)
          - limit: page size (default 50, max 200)
        """
        limit_raw = request.GET.get("limit")
        try:
            limit = int(limit_raw) if limit_raw is not None else 50
        except ValueError:
            limit = 50
        limit = max(1, min(limit, 200))

        cursor = request.GET.get("cursor")

        integration = self.get_integration(organization.id, integration_id)

        try:
            match integration.provider:
                case IntegrationProviderSlug.SLACK.value:
                    results, next_cursor = _slack_list_channels(
                        integration_id=integration.id, cursor=cursor, limit=limit
                    )
                case IntegrationProviderSlug.DISCORD.value:
                    results, next_cursor = _discord_list_channels(
                        guild_id=str(integration.external_id), cursor=cursor, limit=limit
                    )
                case IntegrationProviderSlug.MSTEAMS.value:
                    results, next_cursor = _msteams_list_channels(
                        integration_id=integration.id,
                        team_id=str(integration.external_id),
                        cursor=cursor,
                        limit=limit,
                    )
                case _:
                    return self.respond(
                        {
                            "results": [],
                            "nextCursor": None,
                            "warning": f"Channel listing not supported for provider '{integration.provider}'.",
                        }
                    )
        except ApiError as e:
            return self.respond({"detail": str(e)}, status=400)

        return self.respond({"results": results, "nextCursor": next_cursor})
