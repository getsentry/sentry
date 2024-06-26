from __future__ import annotations

import time
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from slack_sdk.errors import SlackApiError

from sentry import features
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.utils.users import get_slack_user_data
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

SLACK_GET_CHANNEL_ID_PAGE_SIZE = 200
SLACK_DEFAULT_TIMEOUT = 10
MEMBER_PREFIX = "@"
CHANNEL_PREFIX = "#"
strip_channel_chars = "".join([MEMBER_PREFIX, CHANNEL_PREFIX])


@dataclass(frozen=True)
class SlackChannelIdData:
    """
    Dataclass to hold the results of a channel id lookup.
    Attributes:
        prefix: str: The prefix of the channel name, either "@", "#", or "" (only if the channel_name is None)
        channel_id: str | None: The channel id, if found
        timed_out: bool: Whether the lookup timed out
    """

    prefix: str
    channel_id: str | None
    timed_out: bool


# Different list types in slack that we'll use to resolve a channel name. Format is
# (<list_name>, <result_name>, <prefix>).
LIST_TYPES: list[tuple[str, str, str]] = [
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
) -> SlackChannelIdData:
    """
    Fetches the internal slack id of a channel.
    :param organization: unused
    :param integration: The slack integration
    :param channel_name: The name of the channel
    :param use_async_lookup: Give the function some extra time?
    :return: a SlackChannelIdData object
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
    if features.has("organizations:slack-sdk-get-channel-id", organization):
        return get_channel_id_with_timeout(integration, channel_name, timeout)

    return get_channel_id_with_timeout_deprecated(integration, channel_name, timeout)


def validate_channel_id(name: str, integration_id: int | None, input_channel_id: str) -> None:
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
    name: str | None,
    timeout: int,
) -> SlackChannelIdData:
    """
    Fetches the internal slack id of a channel using scheduled message.
    :param integration: The slack integration
    :param name: The name of the channel
    :param timeout: Our self-imposed time limit.
    :return: a SlackChannelIdData object
    """

    if name is None:
        return SlackChannelIdData(prefix="", channel_id=None, timed_out=False)

    _prefix = ""
    _channel_id = None

    time_to_quit = time.time() + timeout
    client = SlackSdkClient(integration_id=integration.id)

    logger_params = {
        "integration_id": integration.id,
        "name": name,
    }
    try:  # Check for channel
        _channel_id = check_for_channel(client, name)
        _prefix = "#"
    except SlackApiError:
        logger.exception("rule.slack.channel_check_error", extra=logger_params)
        return SlackChannelIdData(prefix=_prefix, channel_id=None, timed_out=False)

    if _channel_id is not None:
        return SlackChannelIdData(prefix=_prefix, channel_id=_channel_id, timed_out=False)

    return check_user_with_timeout(integration, name, time_to_quit)


def check_user_with_timeout(
    integration: Integration, name: str, time_to_quit: int
) -> SlackChannelIdData:
    """
    If the channel is not found, we check if the name is a user.
    """

    _channel_id = None
    _prefix = ""

    payload = {
        "exclude_archived": False,
        "exclude_members": True,
        "types": "public_channel,private_channel",
    }
    users = get_slack_user_data(integration, organization=None, kwargs=payload)

    for user in users:
        # The "name" field is unique (this is the username for users)
        # so we return immediately if we find a match.
        # convert to lower case since all names in Slack are lowercase
        if name and str(user["name"]).casefold() == name.casefold():
            return SlackChannelIdData(prefix="@", channel_id=user["id"], timed_out=False)

        # If we don't get a match on a unique identifier, we look through
        # the users' display names, and error if there is a repeat.
        profile = user.get("profile")
        if profile and profile.get("display_name") == name:
            if _channel_id is not None:
                raise DuplicateDisplayNameError(name)
            else:
                _prefix = "@"
                _channel_id = user["id"]

        # TODO: This is a problem if we don't go through all the users and eventually run in to someone with duplicate display name
        if time.time() > time_to_quit:
            return SlackChannelIdData(prefix=_prefix, channel_id=None, timed_out=True)

    return SlackChannelIdData(prefix=_prefix, channel_id=_channel_id, timed_out=False)


def check_for_channel(
    client: SlackSdkClient,
    name: str,
) -> str | None:
    """
    Returns the channel ID if the channel exists, otherwise None.
    """
    try:
        msg_response = client.chat_scheduleMessage(
            channel=name,
            text="Sentry is verifying your channel is accessible for sending you alert rule notifications",
            post_at=int(time.time() + 500),
        )
    except SlackApiError as e:
        logger_params = {
            "error": str(e),
            "integration_id": client.integration_id,
            "channel": name,
            "post_at": int(time.time() + 500),
        }
        logger.exception("slack.chat_scheduleMessage.error", extra=logger_params)
        if "channel_not_found" in str(e):
            return None
        else:
            raise

    if not msg_response.get("channel"):
        return None

    try:
        client.chat_deleteScheduledMessage(
            channel=msg_response.get("channel"),
            scheduled_message_id=msg_response.get("scheduled_message_id"),
        )
        return msg_response.get("channel")
    except SlackApiError as e:
        # We will not have a "channel_not_found" error here, so we can safely log the error and raise
        logger_params = {
            "error": str(e),
            "integration_id": client.integration_id,
            "channel": name,
            "channel_id": msg_response.get("channel"),
            "scheduled_message_id": msg_response.get("scheduled_message_id"),
        }
        logger.exception("slack.chat_deleteScheduledMessage.error", extra=logger_params)
        raise


def get_channel_id_with_timeout_deprecated(
    integration: Integration | RpcIntegration,
    name: str | None,
    timeout: int,
) -> SlackChannelIdData:
    """
    Fetches the internal slack id of a channel using scheduled message.
    :param integration: The slack integration
    :param name: The name of the channel
    :param timeout: Our self-imposed time limit.
    :return: a SlackChannelIdData object
    """

    payload = {
        "exclude_archived": False,
        "exclude_members": True,
        "types": "public_channel,private_channel",
    }

    time_to_quit = time.time() + timeout

    client = SlackClient(integration_id=integration.id)
    id_data: SlackChannelIdData | None = None
    found_duplicate = False
    prefix = ""
    channel_id = None
    try:  # Check for channel
        channel_id = check_for_channel_deprecated(client, name)
        prefix = "#"
    except ApiError as e:
        if str(e) != "channel_not_found":
            raise
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
                raise
            except ApiError as e:
                logger.info(
                    "rule.slack.user_list_other_error",
                    extra={"error": str(e), "integration_id": integration.id},
                )
                return SlackChannelIdData(prefix, None, False)

            if not isinstance(items, dict):
                continue

            for c in items["members"]:
                # The "name" field is unique (this is the username for users)
                # so we return immediately if we find a match.
                # convert to lower case since all names in Slack are lowercase
                if name and c["name"].lower() == name.lower():
                    prefix = "@"
                    return SlackChannelIdData(prefix, c["id"], False)
                # If we don't get a match on a unique identifier, we look through
                # the users' display names, and error if there is a repeat.
                profile = c.get("profile")
                if profile and profile.get("display_name") == name:
                    if id_data:
                        found_duplicate = True
                    else:
                        prefix = "@"
                        id_data = SlackChannelIdData(prefix, c["id"], False)

            cursor = items.get("response_metadata", {}).get("next_cursor", None)
            if time.time() > time_to_quit:
                return SlackChannelIdData(prefix, None, True)

            if not cursor:
                break

        if found_duplicate:
            raise DuplicateDisplayNameError(name)
        elif id_data:
            return id_data

    return SlackChannelIdData(prefix, channel_id, False)


def check_for_channel_deprecated(client: SlackClient, name: str) -> str | None:
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
