from __future__ import annotations

import logging

from slack_sdk.models.blocks import ActionsBlock, ButtonElement, LinkButtonElement, MarkdownBlock
from taskbroker_client.retry import Retry

from sentry import analytics
from sentry.identity.services.identity import identity_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.models.organization import Organization
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.seer.entrypoints.metrics import (
    SlackEntrypointEventLifecycleMetric,
    SlackEntrypointInteractionType,
)
from sentry.seer.entrypoints.operator import SeerAgentOperator
from sentry.seer.entrypoints.slack.analytics import (
    SlackSeerAgentConversation,
    SlackSeerAgentResponded,
)
from sentry.seer.entrypoints.slack.entrypoint import EntrypointSetupError, SlackAgentEntrypoint
from sentry.seer.entrypoints.slack.mention import build_thread_context, extract_prompt
from sentry.seer.entrypoints.slack.metrics import (
    ProcessMentionFailureReason,
    ProcessMentionHaltReason,
)
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service

_logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.seer.entrypoints.slack.process_mention_for_slack",
    namespace=integrations_tasks,
    processing_deadline_duration=30,
    retry=Retry(times=2, delay=30),
)
def process_mention_for_slack(
    *,
    integration_id: int,
    organization_id: int,
    channel_id: str,
    ts: str,
    thread_ts: str | None = None,
    text: str,
    slack_user_id: str,
    bot_user_id: str,
    conversation_type: SlackSeerAgentConversation = SlackSeerAgentConversation.DIRECT_MESSAGE,
) -> None:
    """
    Process a Slack @mention for Seer Agent.

    Parses the mention, extracts thread context,
    and triggers an Agent run via SeerAgentOperator.

    ``ts`` is the message's own timestamp (always present).
    ``thread_ts`` is the parent thread's timestamp (None for top-level messages).

    Authorization: Access is gated by the org-level ``seer-slack-workflows``
    feature flag and ``has_explorer_access()``.  The incoming webhook is
    verified by ``SlackDMRequest.validate()``.  The Slack user must have a
    linked Sentry identity; if not, an ephemeral prompt to link is sent.
    """

    with SlackEntrypointEventLifecycleMetric(
        interaction_type=SlackEntrypointInteractionType.PROCESS_MENTION,
        integration_id=integration_id,
        organization_id=organization_id,
    ).capture() as lifecycle:
        lifecycle.add_extras(
            {
                "channel_id": channel_id,
                "ts": ts,
                "thread_ts": thread_ts,
                "slack_user_id": slack_user_id,
            },
        )

        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            lifecycle.record_failure(failure_reason=ProcessMentionFailureReason.ORG_NOT_FOUND)
            return

        if not SlackAgentEntrypoint.has_access(organization):
            lifecycle.record_failure(failure_reason=ProcessMentionFailureReason.NO_AGENT_ACCESS)
            return

        try:
            entrypoint = SlackAgentEntrypoint(
                integration_id=integration_id,
                organization_id=organization_id,
                channel_id=channel_id,
                thread_ts=thread_ts or ts,
                slack_user_id=slack_user_id,
            )
        except (ValueError, EntrypointSetupError) as e:
            lifecycle.record_failure(failure_reason=e)
            return

        user = _resolve_user(
            integration=entrypoint.integration,
            slack_user_id=slack_user_id,
        )
        if not user:
            lifecycle.record_halt(ProcessMentionHaltReason.IDENTITY_NOT_LINKED)
            # In a thread, show the prompt in the thread; top-level, show in the channel.
            _send_link_identity_prompt(
                entrypoint=entrypoint,
                thread_ts=thread_ts if thread_ts else "",
            )
            entrypoint.install.set_thread_status(
                channel_id=channel_id,
                thread_ts=thread_ts or ts,
                status="",
            )
            return

        if not organization.has_access(user):
            lifecycle.record_halt(ProcessMentionHaltReason.USER_NOT_ORG_MEMBER)
            _send_not_org_member_message(
                entrypoint=entrypoint,
                thread_ts=thread_ts if thread_ts else "",
                org_name=organization.name,
            )
            entrypoint.install.set_thread_status(
                channel_id=channel_id,
                thread_ts=thread_ts or ts,
                status="",
            )
            return

        prompt = extract_prompt(text, bot_user_id)

        # Only fetch thread context when actually in a thread.
        messages: list[dict] = []
        thread_context: str | None = None
        if thread_ts:
            messages = entrypoint.install.get_thread_history(
                channel_id=channel_id, thread_ts=thread_ts
            )
            thread_context = build_thread_context(messages) or None

        operator = SeerAgentOperator(entrypoint=entrypoint)
        run_id = operator.trigger_agent(
            organization=organization,
            user=user,
            prompt=prompt,
            on_page_context=thread_context,
            category_key="slack_thread",
            category_value=f"{channel_id}:{entrypoint.thread_ts}",
        )

        if run_id is None:
            return

        slack_user_ids_in_thread = {
            msg_user
            for msg in messages
            if isinstance(msg_user := msg.get("user"), str) and msg_user != bot_user_id
        } | {slack_user_id}

        try:
            linked_user_count = _count_linked_users(
                integration=entrypoint.integration,
                slack_user_ids=slack_user_ids_in_thread,
            )
        except Exception as e:
            _logger.warning("seer.slack.process_mention.count_linked_users_failed", exc_info=e)
            linked_user_count = 0

        analytics_event = SlackSeerAgentResponded(
            organization_id=organization.id,
            org_slug=organization.slug,
            user_id=user.id,
            username=user.username,
            thread_ts=thread_ts or ts,
            prompt_length=len(prompt),
            run_id=run_id,
            integration_id=integration_id,
            messages_in_thread=max(len(messages), 1),
            seer_msgs_in_thread=sum(1 for m in messages if m.get("user") == bot_user_id),
            unique_users_in_thread=len(slack_user_ids_in_thread),
            linked_users_in_thread=linked_user_count,
            conversation_type=conversation_type,
        )

        try:
            analytics.record(analytics_event)
        except Exception as e:
            _logger.warning("seer.slack.process_mention.analytics_failed", exc_info=e)


def _resolve_user(
    *,
    integration: RpcIntegration,
    slack_user_id: str,
) -> RpcUser | None:
    """Resolve the Sentry user from a Slack user ID via linked identity."""
    provider = identity_service.get_provider(
        provider_type=integration.provider,
        provider_ext_id=integration.external_id,
    )
    if not provider:
        return None

    identity = identity_service.get_identity(
        filter={
            "provider_id": provider.id,
            "identity_ext_id": slack_user_id,
        }
    )
    if not identity:
        return None

    return user_service.get_user(identity.user_id)


def _count_linked_users(
    *,
    integration: RpcIntegration,
    slack_user_ids: set[str],
) -> int:
    """Count how many of the given Slack user IDs have a linked Sentry identity."""
    if not slack_user_ids:
        return 0

    provider = identity_service.get_provider(
        provider_type=integration.provider,
        provider_ext_id=integration.external_id,
    )
    if not provider:
        return 0

    identities = identity_service.get_identities(
        filter={
            "provider_id": provider.id,
            "identity_ext_ids": list(slack_user_ids),
        }
    )
    return len(identities)


def _send_link_identity_prompt(
    *,
    entrypoint: SlackAgentEntrypoint,
    thread_ts: str,
) -> None:
    """Send an ephemeral message prompting the user to link their Slack identity to Sentry."""
    associate_url = build_linking_url(
        integration=entrypoint.integration,
        slack_id=entrypoint.slack_user_id,
        channel_id=entrypoint.channel_id,
        response_url=None,
    )
    renderable = _build_link_identity_renderable(associate_url)
    entrypoint.install.send_threaded_ephemeral_message(
        slack_user_id=entrypoint.slack_user_id,
        channel_id=entrypoint.channel_id,
        renderable=renderable,
        thread_ts=thread_ts,
    )


def _build_link_identity_renderable(associate_url: str) -> SlackRenderable:
    """Build a SlackRenderable prompting the user to link their Slack identity to Sentry."""
    message = "Link your Slack identity to Sentry to use Seer Agent in Slack."
    return SlackRenderable(
        blocks=[
            MarkdownBlock(text=message),
            ActionsBlock(
                elements=[
                    LinkButtonElement(text="Link", url=associate_url),
                    ButtonElement(text="Cancel", value="ignore"),
                ]
            ),
        ],
        text=message,
    )


def _send_not_org_member_message(
    *,
    entrypoint: SlackAgentEntrypoint,
    thread_ts: str,
    org_name: str,
) -> None:
    """Send an ephemeral message informing the user they are not a member of the organization."""
    message = (
        f"You must be a member of the *{org_name}* Sentry organization to use Seer Agent in Slack."
    )
    renderable = SlackRenderable(
        blocks=[MarkdownBlock(text=message)],
        text=message,
    )
    entrypoint.install.send_threaded_ephemeral_message(
        slack_user_id=entrypoint.slack_user_id,
        channel_id=entrypoint.channel_id,
        renderable=renderable,
        thread_ts=thread_ts,
    )
