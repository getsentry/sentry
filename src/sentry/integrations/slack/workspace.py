"""
Workspace-level Slack API calls, when there is no organization to be bound yet.
We don't want to attach an organization at random to use `SlackIntegration`, so we have these.

If you have an organization in scope, use the instance methods on ``SlackIntegration`` instead.
For example: `integration.get_installation(organization_id).get_thread_history(...)`
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from slack_sdk.errors import SlackApiError

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.utils.constants import SlackScope

_logger = logging.getLogger("sentry.integrations.slack")


def get_conversations_info(*, integration_id: int, channel_id: str) -> dict:
    """Fetch conversations.info. Returns an empty dict on failure."""
    try:
        client = SlackSdkClient(integration_id=integration_id)
        conversations = client.conversations_info(channel=channel_id)
        assert isinstance(conversations.data, dict)
        return conversations.data
    except (SlackApiError, AssertionError) as e:
        _logger.warning(
            "slack.get_conversations_info.error",
            extra={
                "integration_id": integration_id,
                "channel_id": channel_id,
                "error": str(e),
            },
        )
        return {}
    except ValueError as e:
        _logger.warning(
            "slack.get_conversations_info.client_init_failed",
            extra={"integration_id": integration_id, "error": str(e)},
        )
        return {}


def has_history_scope(
    *,
    integration_id: int,
    channel_id: str,
    scopes: Sequence[str] | None = None,
) -> bool:
    """
    Whether the integration is allowed to read the channel's history.

    Checks channels:history for public channels and groups:history for private
    channels. Falls back to fetching conversations.info when we don't hold both
    history scopes unconditionally. DMs/assistant threads are always readable.

    ``scopes`` may be supplied by a caller that already has the integration loaded;
    otherwise we fetch them via the integration service.
    """
    if scopes is None:
        integration = integration_service.get_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        if integration is None:
            return False
        scopes = integration.metadata.get("scopes") or []

    installed = frozenset(scopes)
    if SlackScope.CHANNELS_HISTORY in installed and SlackScope.GROUPS_HISTORY in installed:
        return True

    channel_info = get_conversations_info(integration_id=integration_id, channel_id=channel_id).get(
        "channel", {}
    )
    is_channel = channel_info.get("is_channel", False)
    is_private = channel_info.get("is_private", False)
    is_im = channel_info.get("is_im", False)

    # DMs and assistant threads: the bot is a participant and can always read
    # its own conversation history.
    if is_im:
        return True
    if is_private:
        return SlackScope.GROUPS_HISTORY in installed
    if is_channel:
        return SlackScope.CHANNELS_HISTORY in installed

    _logger.warning(
        "slack.has_history_scope.unrecognized_channel_type",
        extra={"channel_id": channel_id, "channel_info": channel_info},
    )
    return False


def get_thread_history(
    *,
    integration_id: int,
    channel_id: str,
    thread_ts: str,
    scopes: Sequence[str] | None = None,
    latest: str | None = None,
    oldest: str | None = None,
    inclusive: bool | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Fetch thread replies via conversations.replies. Empty list on missing scope or error."""
    if not has_history_scope(integration_id=integration_id, channel_id=channel_id, scopes=scopes):
        return []

    try:
        client = SlackSdkClient(integration_id=integration_id)
        response = client.conversations_replies(
            channel=channel_id,
            ts=thread_ts,
            latest=latest,
            oldest=oldest,
            inclusive=inclusive,
            limit=limit,
        )
        return response.get("messages", []) or []
    except SlackApiError as e:
        _logger.warning(
            "slack.get_thread_history.error",
            extra={
                "integration_id": integration_id,
                "channel_id": channel_id,
                "thread_ts": thread_ts,
                "error": str(e),
            },
        )
        return []
    except ValueError as e:
        _logger.warning(
            "slack.get_thread_history.client_init_failed",
            extra={"integration_id": integration_id, "error": str(e)},
        )
        return []
