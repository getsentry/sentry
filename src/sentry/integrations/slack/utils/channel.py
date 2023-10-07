from __future__ import annotations

import time
from typing import List, Optional, Tuple

from django.core.exceptions import ValidationError

from sentry.integrations.slack.client import SlackClient
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.integration import RpcIntegration
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiRateLimitedError,
    DuplicateDisplayNameError,
    IntegrationError,
)

from . import logger

SLACK_DEFAULT_TIMEOUT = 10
MEMBER_PREFIX = "@"
CHANNEL_PREFIX = "#"
strip_channel_chars = "".join([MEMBER_PREFIX, CHANNEL_PREFIX])

# Different list types in slack that we'll use to resolve a channel name. Format is
# (<list_name>, <result_name>, <prefix>).
LIST_TYPES: List[Tuple[str, str, str]] = [
    ("conversations", "channels", CHANNEL_PREFIX),
    ("users", "members", MEMBER_PREFIX),
]


def strip_channel_name(name: str) -> str:
    return name.lstrip(strip_channel_chars)


def get_channel_id(
    organization: Organization,
    integration: Integration | RpcIntegration,
    channel_name: str,
    use_async_lookup: bool = False,
) -> Tuple[str, Optional[str], bool]:
    """
    Fetches the internal slack id of a channel.
    :param organization: unused
    :param integration: The slack integration
    :param channel_name: The name of the channel
    :param use_async_lookup: Give the function some extra time?
    :return: a tuple of three values
        1. prefix: string (`"#"` or `"@"`)
        2. channel_id: string or `None`
        3. timed_out: boolean (whether we hit our self-imposed time limit)
    """

    channel_name = strip_channel_name(channel_name)

    # longer lookup for the async job
    if use_async_lookup:
        timeout = 3 * 60
    else:
        timeout = SLACK_DEFAULT_TIMEOUT

    # XXX(meredith): For large accounts that have many, many users it's
    # possible for us to timeout while attempting to paginate through to find the user id
    # This means some users are unable to create/update alert rules. To avoid this, we attempt
    # to find the channel id asynchronously if it takes longer than a certain amount of time,
    # which I have set as the SLACK_DEFAULT_TIMEOUT - arbitrarily - to 10 seconds.

    return get_channel_id_with_timeout(integration, channel_name, timeout)


def validate_channel_id(name: str, integration_id: Optional[int], input_channel_id: str) -> None:
    """
    In the case that the user is creating an alert via the API and providing the channel ID and name
    themselves, we want to make sure both values are correct.
    """
    # The empty string should be converted to None
    payload = {"channel": input_channel_id or None}
    client = SlackClient(integration_id=integration_id)
    try:
        results = client.get("/conversations.info", params=payload)
    except ApiError as e:
        if e.text == "channel_not_found":
            raise ValidationError("Channel not found. Invalid ID provided.")
        logger.info("rule.slack.conversation_info_failed", extra={"error": str(e)})
        raise IntegrationError("Could not retrieve Slack channel information.")

    if not isinstance(results, dict):
        raise IntegrationError("Bad slack channel list response.")

    stripped_channel_name = strip_channel_name(name)
    results_channel_name = results.get("channel", {}).get("name")
    if not results_channel_name:
        raise ValidationError("Did not receive channel name from API results")
    if stripped_channel_name != results_channel_name:
        channel_name = results_channel_name
        raise ValidationError(
            f"Received channel name {channel_name} does not match inputted channel name {stripped_channel_name}."
        )


def get_channel_id_with_timeout(
    integration: Integration | RpcIntegration,
    name: Optional[str],
    timeout: int,
) -> Tuple[str, Optional[str], bool]:
    """
    Fetches the internal slack id of a channel using scheduled message.
    :param integration: The slack integration
    :param name: The name of the channel
    :param timeout: Our self-imposed time limit.
    :return: a tuple of three values
        1. prefix: string (`"#"` or `"@"`)
        2. channel_id: string or `None`
        3. timed_out: boolean (whether we hit our self-imposed time limit)
    """

    payload = {
        "exclude_archived": False,
        "exclude_members": True,
        "types": "public_channel,private_channel",
    }

    time_to_quit = time.time() + timeout

    client = SlackClient(integration_id=integration.id)
    id_data: Optional[Tuple[str, Optional[str], bool]] = None
    found_duplicate = False
    prefix = ""
    channel_id = None
    try:  # Check for channel
        channel_id = check_for_channel(client, name)
        prefix = "#"
    except ApiError as e:
        if str(e) != "channel_not_found":
            raise e
        # Check if user
        cursor = ""
        while True:
            # Slack limits the response of `<list_type>.list` to 1000 channels
            try:
                items = client.get("/users.list", params=dict(payload, cursor=cursor, limit=1000))
            except ApiRateLimitedError as e:
                logger.info(
                    "rule.slack.user_list_rate_limited",
                    extra={"error": str(e), "integration_id": integration.id},
                )
                raise e
            except ApiError as e:
                logger.info(
                    "rule.slack.user_list_other_error",
                    extra={"error": str(e), "integration_id": integration.id},
                )
                return prefix, None, False

            if not isinstance(items, dict):
                continue

            for c in items["members"]:
                # The "name" field is unique (this is the username for users)
                # so we return immediately if we find a match.
                # convert to lower case since all names in Slack are lowercase
                if name and c["name"].lower() == name.lower():
                    prefix = "@"
                    return prefix, c["id"], False
                # If we don't get a match on a unique identifier, we look through
                # the users' display names, and error if there is a repeat.
                profile = c.get("profile")
                if profile and profile.get("display_name") == name:
                    if id_data:
                        found_duplicate = True
                    else:
                        prefix = "@"
                        id_data = (prefix, c["id"], False)

            cursor = items.get("response_metadata", {}).get("next_cursor", None)
            if time.time() > time_to_quit:
                return prefix, None, True

            if not cursor:
                break

        if found_duplicate:
            raise DuplicateDisplayNameError(name)
        elif id_data:
            return id_data

    return prefix, channel_id, False


def check_for_channel(client: SlackClient, name: str) -> str | None:
    msg_response = client.post(
        "/chat.scheduleMessage",
        data={
            "channel": name,
            "text": "Sentry is verifying your channel is accessible for sending you alert rule notifications",
            "post_at": int(time.time() + 500),
        },
    )

    if "channel" in msg_response:
        client.post(
            "/chat.deleteScheduledMessage",
            params=dict(
                {
                    "channel": msg_response["channel"],
                    "scheduled_message_id": msg_response["scheduled_message_id"],
                }
            ),
        )

        return msg_response["channel"]
    return None
