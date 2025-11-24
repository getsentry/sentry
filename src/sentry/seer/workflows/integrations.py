import logging
import time
from typing import Literal

from slack_sdk.errors import SlackApiError

from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.seer.workflows.types import ThreadMessage, WorkflowContext
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.seer.workflows.integrations.process_integration_mention_for_seer",
    namespace=seer_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.REGION,
)
def process_integration_mention_for_seer(
    *,
    provider: Literal["slack"],
    trigger_message: ThreadMessage,
    thread_messages: list[ThreadMessage],
    workflow_context: WorkflowContext,
) -> None:
    """
    Processes an integreation thread for a Seer workflow.
    """
    if provider != "slack":
        raise ValueError(f"Unsupported provider: {provider}")

    posted_message_ts = workflow_context["message_id"]
    channel_id = workflow_context["channel_id"]
    issue_link = workflow_context["issue_link"]

    logging_ctx = workflow_context["logging_ctx"]
    logging_ctx["issue_link"] = issue_link.get("url")
    issue_link_args = issue_link.get("args", {})
    issue_id = issue_link_args.get("issue_id")
    logging_ctx["issue_id"] = issue_id
    event_id = issue_link_args.get("event_id")
    logging_ctx["event_id"] = event_id
    organization_slug = issue_link_args.get("org_slug")
    logging_ctx["organization_slug"] = organization_slug
    integration_id = workflow_context.get("integration_id")

    client = SlackSdkClient(integration_id=integration_id)

    # TODO: Pass along the messages and issue data to Seer.
    # It'd probably help to have a concrete interface for incoming messages
    prompt = trigger_message.get("text")
    thread_context = thread_messages
    time.sleep(4)

    try:
        client.chat_update(
            channel=channel_id,
            unfurl_links=False,
            unfurl_media=False,
            ts=posted_message_ts,
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
        )
    except SlackApiError as e:
        logger.info("exit.posting_success_message_error", extra=logging_ctx)
        return
    try:
        client.reactions_add(
            channel=channel_id, name="white_check_mark", timestamp=posted_message_ts
        )
    except SlackApiError as e:
        logger.info("exit.adding_success_reaction_error", extra=logging_ctx)
        return
