from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from slack_sdk.errors import SlackApiError

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.metrics import (
    SLACK_UTILS_CHANNEL_FAILURE_DATADOG_METRIC,
    SLACK_UTILS_CHANNEL_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.utils.errors import (
    CHANNEL_NOT_FOUND,
    RATE_LIMITED,
    unpack_slack_api_error,
)
from sentry.integrations.slack.utils.users import get_slack_user_list
from sentry.shared_integrations.exceptions import (
    ApiRateLimitedError,
    DuplicateDisplayNameError,
    IntegrationError,
)
from sentry.utils import metrics

_logger = logging.getLogger(__name__)

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
    integration: Integration | RpcIntegration, channel_name: str, use_async_lookup: bool = False
) -> SlackChannelIdData:
    """
    Fetches the internal slack id of a channel.
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
    return get_channel_id_with_timeout(integration, channel_name, timeout)


def validate_channel_id(name: str, integration_id: int | None, input_channel_id: str) -> None:
    """
    In the case that the user is creating an alert via the API and providing the channel ID and name
    themselves, we want to make sure both values are correct.
    """

    client = SlackSdkClient(integration_id=integration_id)
    try:
        results = client.conversations_info(channel=input_channel_id).data
        metrics.incr(
            SLACK_UTILS_CHANNEL_SUCCESS_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"type": "conversations_info"},
        )
    except SlackApiError as e:
        metrics.incr(
            SLACK_UTILS_CHANNEL_FAILURE_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"type": "conversations_info"},
        )
        _logger.exception(
            "rule.slack.conversation_info_failed",
            extra={
                "integration_id": integration_id,
                "channel_name": name,
                "input_channel_id": input_channel_id,
            },
        )

        if unpack_slack_api_error(e) == CHANNEL_NOT_FOUND:
            raise ValidationError("Channel not found. Invalid ID provided.") from e
        elif unpack_slack_api_error(e) == RATE_LIMITED:
            raise ValidationError("Rate limited") from e

        raise ValidationError("Could not retrieve Slack channel information.") from e

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
        "channel_name": name,
    }
    try:  # Check for channel
        _channel_id = check_for_channel(client, name)
        _prefix = "#"
    except SlackApiError:
        _logger.exception("rule.slack.channel_check_error", extra=logger_params)
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

    logger_params = {
        "integration_id": integration.id,
        "channel_name": name,
    }

    # Get each user from a page from the Slack API
    user_generator = (
        user
        for page in get_slack_user_list(integration, organization=None, kwargs=payload)
        for user in page
    )

    try:
        for user in user_generator:
            # The "name" field is unique (this is the username for users)
            # so we return immediately if we find a match.
            # convert to lower case since all names in Slack are lowercase
            if name and str(user["name"]).casefold() == name.casefold():
                metrics.incr(
                    SLACK_UTILS_CHANNEL_SUCCESS_DATADOG_METRIC,
                    sample_rate=1.0,
                    tags={"type": "users_list"},
                )
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
                metrics.incr(
                    SLACK_UTILS_CHANNEL_FAILURE_DATADOG_METRIC,
                    sample_rate=1.0,
                    tags={"type": "users_list", "timed_out": True},
                )
                return SlackChannelIdData(prefix=_prefix, channel_id=None, timed_out=True)
    except SlackApiError as e:
        _logger.exception("rule.slack.user_check_error", extra=logger_params)
        if unpack_slack_api_error(e) == RATE_LIMITED:
            metrics.incr(
                SLACK_UTILS_CHANNEL_FAILURE_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "users_list", "ratelimited": True},
            )
            raise ApiRateLimitedError("Slack rate limited") from e
        metrics.incr(
            SLACK_UTILS_CHANNEL_FAILURE_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"type": "users_list"},
        )

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
        metrics.incr(
            SLACK_UTILS_CHANNEL_SUCCESS_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"type": "chat_scheduleMessage"},
        )
    except SlackApiError as e:
        metrics.incr(
            SLACK_UTILS_CHANNEL_FAILURE_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"type": "chat_scheduleMessage"},
        )
        logger_params = {
            "error": str(e),
            "integration_id": client.integration_id,
            "channel": name,
            "post_at": int(time.time() + 500),
        }
        _logger.exception("slack.chat_scheduleMessage.error", extra=logger_params)
        if unpack_slack_api_error(e) == CHANNEL_NOT_FOUND:
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
        metrics.incr(
            SLACK_UTILS_CHANNEL_SUCCESS_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"type": "chat_deleteScheduledMessage"},
        )
        return msg_response.get("channel")
    except SlackApiError as e:
        metrics.incr(
            SLACK_UTILS_CHANNEL_FAILURE_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"type": "chat_deleteScheduledMessage"},
        )
        # We will not have a "channel_not_found" error here, so we can safely log the error and raise
        logger_params = {
            "error": str(e),
            "integration_id": client.integration_id,
            "channel": name,
            "channel_id": msg_response.get("channel"),
            "scheduled_message_id": msg_response.get("scheduled_message_id"),
        }
        _logger.exception("slack.chat_deleteScheduledMessage.error", extra=logger_params)
        raise
