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
from sentry.seer.workflows.integrations import process_integration_mention_for_seer
from sentry.seer.workflows.types import MessageLink, ThreadMessage
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

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

    known_links: list[MessageLink] = []
    for url in urls:
        # TODO(leander): Add organization slug to Discover & Metric Alert links as well
        link_type, args = match_link(url)
        if link_type is not None:
            known_links.append(
                {
                    "url": url,
                    "link_type": link_type.value,
                    "args": args,
                }
            )

    return known_links


@instrumented_task(
    name="sentry.seer.workflows.slack.process_initial_slack_mention_for_seer",
    namespace=seer_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CONTROL,
)
def process_initial_slack_mention_for_seer(
    *, channel_id: str, trigger_ts: str, thread_ts: str, integration_id: int
) -> None:
    """
    Processes the initial Slack @mention for a Seer workflow, spawns a subtask which will handle
    region-data processing.

    channel_id: The ID of the slack channel in which the @mention was made.
    trigger_ts: The timestamp of the message that did the @mention.
    thread_ts: The timestamp of the thread in which the @mention was made.
    integration_id: The ID of the Slack integration whose installation received the webhook.
    """
    logging_ctx = {
        "provider": "slack",
        "channel_id": channel_id,
        "trigger_ts": trigger_ts,
        "thread_ts": thread_ts,
        "integration_id": integration_id,
    }
    client = SlackSdkClient(integration_id=integration_id)
    posted_message_ts = None
    try:
        client.reactions_add(channel=channel_id, name="saluting_face", timestamp=trigger_ts)
    except SlackApiError as e:
        logger.info("exit.acknowledgement_reaction_error", extra=logging_ctx)
        return

    try:
        seer_message_response = client.chat_postMessage(
            channel=channel_id,
            text="Seer is processing the thread and will work on fixing the following issue:",
            thread_ts=trigger_ts,
        )
        posted_message_ts = seer_message_response.get("ts")
    except SlackApiError as e:
        logger.info("exit.acknowledging_message_error", extra=logging_ctx)

    try:
        messages_response = client.conversations_replies(
            channel=channel_id, ts=thread_ts, limit=1000, latest="now"
        )
    except SlackApiError as e:
        logger.info("exit.fetching_threaded_messages_error", extra=logging_ctx)
        return

    raw_items: list[Mapping[str, Any]] = messages_response.get("messages", [])
    logging_ctx["num_messages"] = len(raw_items)
    issue_links = []

    trigger_message: ThreadMessage | None = None
    messages: list[ThreadMessage] = []
    for item in raw_items:
        if item.get("type") != "message":
            continue

        known_links = extract_known_links_from_slack_blocks(item.get("blocks", []))
        issue_links.extend(link for link in known_links if link.get("link_type") == LinkType.ISSUES)
        # TODO(leander): Maybe factor in author later on with Identity service
        message: ThreadMessage = {
            "id": item.get("ts"),
            "timestamp": item.get("ts"),
            "text": item.get("text"),
            "links": known_links,
        }
        if item.get("ts") == trigger_ts:
            trigger_message = message
        messages.append(message)

    if not issue_links:
        client.reactions_add(channel=channel_id, name="mag", timestamp=trigger_ts)
        client.chat_update(
            ts=posted_message_ts,
            channel=channel_id,
            text="Seer needs an issue link to help you out. Paste one in the thread and it'll take it from there.",
        )
        logger.info("exit.no_issue_link_found", extra=logging_ctx)
        return

    organization_slugs = {link.get("args", {}).get("org_slug") for link in issue_links}
    mappings = OrganizationMapping.objects.filter(slug__in=organization_slugs)
    organization_ids = mappings.values_list("organization_id", flat=True)
    logging_ctx["organization_slugs"] = organization_slugs
    organization_integrations = OrganizationIntegration.objects.filter(
        organization_id__in=organization_ids,
        integration_id=integration_id,
        status=ObjectStatus.ACTIVE,
    )

    if not organization_integrations:
        client.reactions_add(channel=channel_id, name="broken_heart", timestamp=trigger_ts)
        client.chat_update(
            ts=posted_message_ts,
            channel=channel_id,
            text="Looks like your Slack installation isn't active anymore :(",
        )
        logger.info("exit.incorrect_organization", extra=logging_ctx)
        return

    # TODO(Leander): Create an intermediate step where seer asks which issue focus on solving.
    issue_link = issue_links[0]

    process_integration_mention_for_seer.delay(
        trigger_message=trigger_message,
        thread_messages=messages,
        workflow_context={
            "message_id": posted_message_ts,
            "channel_id": channel_id,
            "issue_link": issue_link,
            "integration_id": integration_id,
            "logging_ctx": logging_ctx,
        },
    )
