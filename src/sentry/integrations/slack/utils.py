import logging
import time
from typing import List, Tuple
from urllib.parse import parse_qs, urlencode, urlparse

from django.core.exceptions import ValidationError
from django.http import Http404

from sentry.constants import ObjectStatus
from sentry.models import IdentityProvider, Integration, Organization
from sentry.shared_integrations.exceptions import (
    ApiError,
    DuplicateDisplayNameError,
    IntegrationError,
)
from sentry.utils import json

from .client import SlackClient

logger = logging.getLogger("sentry.integrations.slack")

# Attachment colors used for issues with no actions take
LEVEL_TO_COLOR = {
    "debug": "#fbe14f",
    "info": "#2788ce",
    "warning": "#FFC227",
    "error": "#E03E2F",
    "fatal": "#FA4747",
}

ACTIONED_ISSUE_COLOR = "#EDEEEF"
INCIDENT_RESOLVED_COLOR = "#4dc771"


MEMBER_PREFIX = "@"
CHANNEL_PREFIX = "#"
strip_channel_chars = "".join([MEMBER_PREFIX, CHANNEL_PREFIX])
SLACK_DEFAULT_TIMEOUT = 10


def get_integration_type(integration: Integration):
    metadata = integration.metadata
    # classic bots had a user_access_token in the metadata
    default_installation = "classic_bot" if "user_access_token" in metadata else "workspace_app"
    return metadata.get("installation_type", default_installation)


# Different list types in slack that we'll use to resolve a channel name. Format is
# (<list_name>, <result_name>, <prefix>).
LIST_TYPES: List[Tuple[str, str, str]] = [
    ("conversations", "channels", CHANNEL_PREFIX),
    ("users", "members", MEMBER_PREFIX),
]


def strip_channel_name(name: str):
    return name.lstrip(strip_channel_chars)


def get_channel_id(
    organization: Organization, integration: Integration, name: str, use_async_lookup: bool = False
):
    """
    Fetches the internal slack id of a channel.
    :param organization: The organization that is using this integration
    :param integration: The slack integration
    :param name: The name of the channel
    :return: a tuple of three values
        1. prefix: string (`"#"` or `"@"`)
        2. channel_id: string or `None`
        3. timed_out: boolean (whether we hit our self-imposed time limit)
    """

    name = strip_channel_name(name)

    # longer lookup for the async job
    if use_async_lookup:
        timeout = 3 * 60
    else:
        timeout = SLACK_DEFAULT_TIMEOUT

    # XXX(meredith): For large accounts that have many, many channels it's
    # possible for us to timeout while attempting to paginate through to find the channel id
    # This means some users are unable to create/update alert rules. To avoid this, we attempt
    # to find the channel id asynchronously if it takes longer than a certain amount of time,
    # which I have set as the SLACK_DEFAULT_TIMEOUT - arbitrarily - to 10 seconds.
    return get_channel_id_with_timeout(integration, name, timeout)


def validate_channel_id(name: str, integration_id: int, input_channel_id: str) -> None:
    """
    In the case that the user is creating an alert via the API and providing the channel ID and name
    themselves, we want to make sure both values are correct.
    """
    try:
        integration = Integration.objects.get(id=integration_id)
    except Integration.DoesNotExist:
        raise Http404

    token = integration.metadata["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"channel": input_channel_id}
    client = SlackClient()

    try:
        results = client.get("/conversations.info", headers=headers, params=payload)
    except ApiError as e:
        if e.text == "channel_not_found":
            raise ValidationError("Channel not found. Invalid ID provided.")
        logger.info("rule.slack.conversation_info_failed", extra={"error": str(e)})
        raise IntegrationError("Could not retrieve Slack channel information.")

    if not isinstance(results, dict):
        raise IntegrationError("Bad slack channel list response.")

    stripped_channel_name = strip_channel_name(name)
    if not stripped_channel_name == results["channel"]["name"]:
        channel_name = results["channel"]["name"]
        raise ValidationError(
            f"Received channel name {channel_name} does not match inputted channel name {stripped_channel_name}."
        )


def get_channel_id_with_timeout(integration: Integration, name: str, timeout: int):
    """
    Fetches the internal slack id of a channel.
    :param integration: The slack integration
    :param name: The name of the channel
    :param timeout: Our self-imposed time limit.
    :return: a tuple of three values
        1. prefix: string (`"#"` or `"@"`)
        2. channel_id: string or `None`
        3. timed_out: boolean (whether we hit our self-imposed time limit)
    """

    headers = {"Authorization": "Bearer %s" % integration.metadata["access_token"]}

    payload = {
        "exclude_archived": False,
        "exclude_members": True,
        "types": "public_channel,private_channel",
    }

    list_types = LIST_TYPES

    time_to_quit = time.time() + timeout

    client = SlackClient()
    id_data = None
    found_duplicate = False
    prefix = ""

    for list_type, result_name, prefix in list_types:
        cursor = ""
        while True:
            endpoint = "/%s.list" % list_type
            try:
                # Slack limits the response of `<list_type>.list` to 1000 channels
                items = client.get(
                    endpoint, headers=headers, params=dict(payload, cursor=cursor, limit=1000)
                )
            except ApiError as e:
                logger.info("rule.slack.%s_list_failed" % list_type, extra={"error": str(e)})
                return (prefix, None, False)

            if not isinstance(items, dict):
                continue

            for c in items[result_name]:
                # The "name" field is unique (this is the username for users)
                # so we return immediately if we find a match.
                # convert to lower case since all names in Slack are lowercase
                if c["name"].lower() == name.lower():
                    return (prefix, c["id"], False)
                # If we don't get a match on a unique identifier, we look through
                # the users' display names, and error if there is a repeat.
                if list_type == "users":
                    profile = c.get("profile")
                    if profile and profile.get("display_name") == name:
                        if id_data:
                            found_duplicate = True
                        else:
                            id_data = (prefix, c["id"], False)

            cursor = items.get("response_metadata", {}).get("next_cursor", None)
            if time.time() > time_to_quit:
                return (prefix, None, True)

            if not cursor:
                break
        if found_duplicate:
            raise DuplicateDisplayNameError(name)
        elif id_data:
            return id_data

    return (prefix, None, False)


def send_incident_alert_notification(action, incident, metric_value, method):
    from sentry.integrations.slack.message_builder.incidents import build_incident_attachment

    # Make sure organization integration is still active:
    try:
        integration = Integration.objects.get(
            id=action.integration_id,
            organizations=incident.organization,
            status=ObjectStatus.VISIBLE,
        )
    except Integration.DoesNotExist:
        # Integration removed, but rule is still active.
        return

    channel = action.target_identifier
    attachment = build_incident_attachment(action, incident, metric_value, method)
    payload = {
        "token": integration.metadata["access_token"],
        "channel": channel,
        "attachments": json.dumps([attachment]),
    }

    client = SlackClient()
    try:
        client.post("/chat.postMessage", data=payload, timeout=5)
    except ApiError as e:
        logger.info("rule.fail.slack_post", extra={"error": str(e)})


def get_identity(user, organization_id, integration_id):
    try:
        organization = Organization.objects.get(id__in=user.get_orgs(), id=organization_id)
    except Organization.DoesNotExist:
        raise Http404

    try:
        integration = Integration.objects.get(id=integration_id, organizations=organization)
    except Integration.DoesNotExist:
        raise Http404

    try:
        idp = IdentityProvider.objects.get(external_id=integration.external_id, type="slack")
    except IdentityProvider.DoesNotExist:
        raise Http404

    return organization, integration, idp


def parse_link(url):
    """
    For data aggreggation purposes, rm unique information from URL
    """

    url_parts = list(urlparse(url))
    query = dict(parse_qs(url_parts[4]))
    for param in query:
        if param == "project":
            query.update({"project": "{project}"})

    url_parts[4] = urlencode(query)
    parsed_path = url_parts[2].strip("/").split("/")
    scrubbed_items = {"organizations": "organization", "issues": "issue_id", "events": "event_id"}
    new_path = []
    for index, item in enumerate(parsed_path):
        if item in scrubbed_items:
            if len(parsed_path) > index + 1:
                parsed_path[index + 1] = "{%s}" % (scrubbed_items[item])
        new_path.append(item)

    parsed_path = "/".join(new_path)
    parsed_path += "/" + str(url_parts[4])

    return parsed_path
