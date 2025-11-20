import json
import logging
import time
from collections.abc import Mapping
from typing import Any

from slack_sdk.errors import SlackApiError

from sentry.constants import ObjectStatus
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.unfurl.handlers import match_link
from sentry.integrations.slack.unfurl.types import LinkType
from sentry.models.organizationmapping import OrganizationMapping
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)


def extract_known_links_from_slack_blocks(blocks: list[dict]) -> list[dict[str, Any]]:
    """
    Recursively extract all URLs from Slack message blocks.
    Looks for elements with type="link" and extracts their url field.
    """
    urls = []

    def extract_any_link_from_slack_block(block: dict) -> None:
        if (block.get("type") == "link") and (url := block.get("url")):
            urls.append(url)
        for element in block.get("elements", []):
            extract_any_link_from_slack_block(element)

    for block in blocks:
        extract_any_link_from_slack_block(block)

    known_links = []
    for url in urls:
        # TODO(leander): Add organization slug to Discover & Metric Alert links as well
        link_type, args = match_link(url)
        if link_type is not None:
            known_links.append(
                {
                    "url": url,
                    "link_type": link_type,
                    "args": args,
                }
            )

    return known_links


@instrumented_task(
    name="sentry.seer.workflows.process_slack_thread_for_seer",
    namespace=seer_tasks,
    processing_deadline_duration=60,  # IDK, how long does seer take?
    silo_mode=SiloMode.CONTROL,
)
def process_slack_thread_for_seer(
    *, channel_id: str, message_ts: str, reply_thread_ts: str, integration_id: int
) -> None:
    logging_ctx = {
        "provider": "slack",
        "channel_id": channel_id,
        "message_ts": message_ts,
        "reply_thread_ts": reply_thread_ts,
        "integration_id": integration_id,
    }
    client = SlackSdkClient(integration_id=integration_id)
    try:
        client.reactions_add(channel=channel_id, name="saluting_face", timestamp=message_ts)
    except SlackApiError as e:
        logger.info("exit.acknowledgement_reaction_error", extra=logging_ctx)
        return

    try:
        messages_response = client.conversations_replies(
            channel=channel_id, ts=reply_thread_ts, limit=1000, latest="now"
        )
    except SlackApiError as e:
        logger.info("exit.fetching_threaded_messages_error", extra=logging_ctx)
        return

    raw_items: list[Mapping[str, Any]] = messages_response.get("messages", [])
    logging_ctx["num_messages"] = len(raw_items)
    issue_links = []

    simplified_messages = []
    for item in raw_items:
        if item.get("type") != "message":
            continue

        known_links = extract_known_links_from_slack_blocks(item.get("blocks", []))
        issue_links.extend(link for link in known_links if link.get("link_type") == LinkType.ISSUES)
        # TODO(leander): Maybe factor in author later on with Identity service
        simplified_message = {
            "timestamp": item.get("ts"),
            "text": item.get("text"),
            "links": known_links,
        }
        simplified_messages.append(simplified_message)

    if not issue_links:
        client.reactions_add(channel=channel_id, name="mag", timestamp=message_ts)
        client.chat_postMessage(
            channel=channel_id,
            text="Seer needs an issue link to help you out. Paste one in the thread and it'll take it from there.",
            thread_ts=message_ts,
        )
        logger.info("exit.no_issue_link_found", extra=logging_ctx)
        return

    organization_slugs = {link.get("args", {}).get("org_slug") for link in issue_links}
    organization_ids = OrganizationMapping.objects.filter(slug__in=organization_slugs).values_list(
        "organization_id", flat=True
    )
    logging_ctx["organization_slugs"] = organization_slugs
    organization_integrations = OrganizationIntegration.objects.filter(
        organization_id__in=organization_ids,
        integration_id=integration_id,
        status=ObjectStatus.ACTIVE,
    )

    if not organization_integrations:
        client.reactions_add(channel=channel_id, name="broken_heart", timestamp=message_ts)
        client.chat_postMessage(
            channel=channel_id,
            text="Looks like your Slack installation isn't active anymore :(",
            thread_ts=message_ts,
        )
        logger.info("exit.incorrect_organization", extra=logging_ctx)
        return

    # TODO(Leander): Create an intermediate step where seer asks which issue focus on solving.
    issue_link = issue_links[0]
    logging_ctx["issue_link"] = issue_link

    # TODO: Pass along the messages and issue data to Seer.
    # It'd probably help to have a concrete interface for incoming messages
    time.sleep(4)

    try:
        client.chat_postMessage(
            channel=channel_id,
            unfurl_links=False,
            unfurl_media=False,
            text="Seer has processed the thread and will work on fixing the following issue:",
            blocks=[
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        # TODO(leander): Get the short ID from the issue
                        "text": f"_eye-spy_, Seer found an issue in the thread: <{issue_link.get('url')}|SENTRY-123>",
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Summary*: Search query failed due to InvalidSearchQuery on the 'issue:' filter.",
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Root Cause*: Stale alert rule filter referencing non-existent group causes strict ID lookup validation to fail, raising InvalidSearchQuery.",
                    },
                },
                {
                    "type": "actions",
                    # TODO(leander): Add buttons for every stage in the seer workflow.
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": ":books: What's the solution?",
                                "emoji": True,
                            },
                            "value": "seer:solution",
                            "action_id": "seer:solution",
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": ":hammer_and_wrench: Fix this for me.",
                                "emoji": True,
                            },
                            "value": "seer:pull-request-create",
                            "action_id": "seer:pull-request-create",
                        },
                    ],
                },
            ],
            thread_ts=message_ts,
        )
    except SlackApiError as e:
        logger.info("exit.posting_success_message_error", extra=logging_ctx)
        return
    try:
        client.reactions_add(channel=channel_id, name="white_check_mark", timestamp=message_ts)
    except SlackApiError as e:
        logger.info("exit.adding_success_reaction_error", extra=logging_ctx)
        return
    # print(json.dumps(simplified_messages, indent=4))
