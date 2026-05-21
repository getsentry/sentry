from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any, NamedTuple

from slack_sdk.models.blocks import MarkdownBlock
from taskbroker_client.retry import Retry

from sentry import analytics
from sentry.identity.services.identity import identity_service
from sentry.integrations.messaging.metrics import SeerSlackHaltReason
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
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
from sentry.seer.entrypoints.slack.cache import SlackSeerAgentMessageCache
from sentry.seer.entrypoints.slack.entrypoint import EntrypointSetupError, SlackAgentEntrypoint
from sentry.seer.entrypoints.slack.mention import (
    SlackMessageLink,
    build_linked_messages_context,
    build_thread_context,
    extract_prompt,
    extract_slack_message_links,
    find_message_in_attachments,
)
from sentry.seer.entrypoints.slack.messaging import send_halt_message
from sentry.seer.entrypoints.slack.metrics import (
    ProcessMentionFailureReason,
    ProcessMentionHaltReason,
    ProcessReactionFailureReason,
    ProcessReactionHaltReason,
)
from sentry.seer.entrypoints.types import SeerEntrypointKey
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
    attachments: Sequence[Mapping[str, Any]] | None = None,
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
            send_halt_message(
                integration=entrypoint.integration,
                slack_user_id=entrypoint.slack_user_id,
                channel_id=entrypoint.channel_id,
                thread_ts=thread_ts if thread_ts else "",
                halt_reason=SeerSlackHaltReason.IDENTITY_NOT_LINKED,
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

        linked_result = _resolve_linked_messages(
            text=text,
            entrypoint=entrypoint,
            attachments=attachments,
        )

        # Only fetch thread context when actually in a thread.
        messages: list[dict] = []
        thread_context: str | None = None
        if thread_ts:
            messages = entrypoint.install.get_thread_history(
                channel_id=channel_id, thread_ts=thread_ts
            )
            thread_context = build_thread_context(messages) or None

        parts = [p for p in (linked_result.block, thread_context) if p]
        on_page_context = "\n\n".join(parts) if parts else None

        if linked_result.unresolved_channel_ids or linked_result.private_channel_ids:
            _send_inaccessible_links_prompt(
                entrypoint=entrypoint,
                thread_ts=thread_ts or ts,
                unresolved_channel_ids=linked_result.unresolved_channel_ids,
                private_channel_ids=linked_result.private_channel_ids,
            )

        operator = SeerAgentOperator(entrypoint=entrypoint)
        run_id = operator.trigger_agent(
            organization=organization,
            user=user,
            prompt=prompt,
            on_page_context=on_page_context,
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

        _logger.info(
            "seer.slack.process_mention.success",
            extra={
                "referrer": SeerEntrypointKey.SLACK,
                "organization_id": organization.id,
                "user_id": user.id,
                "integration_id": integration_id,
                "run_id": run_id,
                "thread_ts": thread_ts or ts,
                "channel_id": channel_id,
                "slack_user_id": slack_user_id,
                "conversation_type": conversation_type,
            },
        )


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
    try:
        entrypoint.install.send_threaded_ephemeral_message(
            slack_user_id=entrypoint.slack_user_id,
            channel_id=entrypoint.channel_id,
            renderable=renderable,
            thread_ts=thread_ts,
        )
    except Exception as e:
        _logger.warning("seer.slack.process_mention.send_not_org_member_message_failed", exc_info=e)


class _LinkedMessagesResult(NamedTuple):
    block: str
    unresolved_channel_ids: list[str]
    private_channel_ids: list[str]


def _resolve_linked_messages(
    *,
    text: str,
    entrypoint: SlackAgentEntrypoint,
    attachments: Sequence[Mapping[str, Any]] | None = None,
) -> _LinkedMessagesResult:
    """Fetch the single linked message for any Slack permalinks in ``text`` and
    render them as a Seer context block.

    Resolution strategy per link:

    1. If the inbound event already includes the message as an auto-unfurl
       attachment, use that.
    2. Otherwise, skip private channels and fetch only the single linked message
    via ``conversations.history`` / ``conversations.replies`` for public channels.

    Returns the rendered block plus the deduped lists of channel ids we
    couldn't read (unresolved = bot not invited / scope missing) or
    intentionally skipped (private).
    """
    domain_name = entrypoint.integration.metadata.get("domain_name")
    links = extract_slack_message_links(text, domain_name=domain_name)
    if not links:
        return _LinkedMessagesResult(block="", unresolved_channel_ids=[], private_channel_ids=[])

    msgs_to_include: list[tuple[SlackMessageLink, list[Mapping[str, Any]]]] = []
    unresolved: set[str] = set()
    private_channels: set[str] = set()
    for link in links:
        attachment_message = find_message_in_attachments(link, attachments)
        if attachment_message is not None:
            msgs_to_include.append((link, [attachment_message]))
            continue

        try:
            conversation_info = entrypoint.install.get_conversations_info(
                channel_id=link.channel_id
            )
        except Exception as e:
            _logger.warning("seer.slack.process_mention.get_conversations_info_failed", exc_info=e)
            unresolved.add(link.channel_id)
            continue

        if conversation_info.get("channel", {}).get("is_private"):
            private_channels.add(link.channel_id)
            continue

        # This will only fetch the single message that was linked PLUS the parent message,
        # if that linked message was in a thread.
        try:
            messages = entrypoint.install.get_thread_history(
                channel_id=link.channel_id,
                thread_ts=link.thread_ts or link.ts,
                latest=link.ts,
                oldest=link.ts,
                inclusive=True,
                limit=1,
            )
        except Exception as e:
            _logger.warning("seer.slack.process_mention.get_thread_history_failed", exc_info=e)
            unresolved.add(link.channel_id)
            continue

        # If the parent message is also included, ignore that
        message = next((m for m in messages if m.get("ts") == link.ts), None)
        if message is None:
            unresolved.add(link.channel_id)
            continue
        msgs_to_include.append((link, [message]))

    _logger.info(
        "seer.slack.process_mention.linked_messages_resolved",
        extra={
            "requested": len(links),
            "fetched": len(msgs_to_include),
        },
    )

    return _LinkedMessagesResult(
        block=build_linked_messages_context(msgs_to_include),
        unresolved_channel_ids=list(unresolved),
        private_channel_ids=list(private_channels),
    )


def _send_inaccessible_links_prompt(
    *,
    entrypoint: SlackAgentEntrypoint,
    thread_ts: str,
    unresolved_channel_ids: list[str],
    private_channel_ids: list[str],
) -> None:
    """Tell the user we couldn't read some linked messages."""
    renderable = _build_inaccessible_links_renderable(
        unresolved_channel_ids=unresolved_channel_ids,
        private_channel_ids=private_channel_ids,
    )
    try:
        entrypoint.install.send_threaded_ephemeral_message(
            slack_user_id=entrypoint.slack_user_id,
            channel_id=entrypoint.channel_id,
            renderable=renderable,
            thread_ts=thread_ts,
        )
    except Exception as e:
        _logger.warning(
            "seer.slack.process_mention.send_inaccessible_links_prompt_failed", exc_info=e
        )


def _build_inaccessible_links_renderable(
    *,
    unresolved_channel_ids: list[str],
    private_channel_ids: list[str],
) -> SlackRenderable:
    """Build the ephemeral explaining which linked messages we skipped and why."""
    sections: list[str] = []

    if unresolved_channel_ids:
        unresolved_channel_links = [f"<#{cid}>" for cid in unresolved_channel_ids]
        unresolved_channel_text = ", ".join(unresolved_channel_links)
        sections.append(
            f"I need to be invited to read from some channels: {unresolved_channel_text}"
        )

    if private_channel_ids:
        private_channel_links = [f"<#{cid}>" for cid in private_channel_ids]
        private_channel_text = ", ".join(private_channel_links)
        sections.append(
            f"For privacy, I don't read messages from private channels: {private_channel_text}"
        )

    message = "\n\n".join(sections)
    return SlackRenderable(blocks=[MarkdownBlock(text=message)], text=message)


@instrumented_task(
    name="sentry.seer.entrypoints.slack.process_reaction_for_slack",
    namespace=integrations_tasks,
    processing_deadline_duration=30,
    retry=Retry(times=2, delay=30),
)
def process_reaction_for_slack(
    *,
    integration_id: int,
    organization_id: int,
    channel_id: str,
    message_ts: str,
    reaction: str,
    reactor_slack_user_id: str,
) -> None:
    """
    Process a Slack reaction on a Seer bot message to record feedback.

    Only handles :+1: and :-1: reactions on messages our bot posted in Seer threads.
    Records an analytics event and sends an ephemeral acknowledgement.
    """
    from sentry.integrations.slack.integration import SlackIntegration
    from sentry.integrations.slack.webhooks.event import SEER_FEEDBACK_REACTION_PREFIXES
    from sentry.seer.entrypoints.slack.analytics import SlackSeerAgentFeedback

    with SlackEntrypointEventLifecycleMetric(
        interaction_type=SlackEntrypointInteractionType.PROCESS_REACTION,
        integration_id=integration_id,
        organization_id=organization_id,
    ).capture() as lifecycle:
        lifecycle.add_extras(
            {
                "channel_id": channel_id,
                "message_ts": message_ts,
                "reaction": reaction,
                "reactor_slack_user_id": reactor_slack_user_id,
            },
        )

        if not reaction.startswith(SEER_FEEDBACK_REACTION_PREFIXES):
            lifecycle.record_halt(ProcessReactionHaltReason.UNSUPPORTED_REACTION)
            return

        feedback_type = "positive" if reaction.startswith("+") else "negative"

        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            lifecycle.record_failure(failure_reason=ProcessReactionFailureReason.ORG_NOT_FOUND)
            return

        if not SlackAgentEntrypoint.has_access(organization):
            lifecycle.record_halt(halt_reason=ProcessReactionHaltReason.NO_AGENT_ACCESS)
            return

        cached = SlackSeerAgentMessageCache.get(
            integration_id=integration_id, channel_id=channel_id, message_ts=message_ts
        )
        if not cached:
            lifecycle.record_halt(halt_reason=ProcessReactionHaltReason.THREAD_NOT_FOUND)
            return
        thread_ts = cached["thread_ts"]
        run_id = cached["run_id"]

        integration = integration_service.get_integration(integration_id=integration_id)
        if not integration:
            lifecycle.record_failure(
                failure_reason=ProcessReactionFailureReason.INTEGRATION_NOT_FOUND
            )
            return

        user = _resolve_user(integration=integration, slack_user_id=reactor_slack_user_id)
        if not user:
            lifecycle.record_halt(ProcessReactionHaltReason.IDENTITY_NOT_LINKED)
            return

        install = integration.get_installation(organization_id=organization_id)
        if not install:
            lifecycle.record_failure(
                failure_reason=ProcessReactionFailureReason.INSTALLATION_NOT_FOUND
            )
            return
        if not isinstance(install, SlackIntegration):
            lifecycle.record_failure(
                failure_reason=ProcessReactionFailureReason.INSTALLATION_NOT_FOUND
            )
            return

        try:
            analytics.record(
                SlackSeerAgentFeedback(
                    organization_id=organization.id,
                    org_slug=organization.slug,
                    thread_ts=thread_ts,
                    user_id=user.id,
                    username=user.username,
                    feedback_type=feedback_type,
                    run_id=run_id,
                    integration_id=integration_id,
                )
            )
        except Exception:
            _logger.warning("seer.slack.process_reaction.analytics_failed", exc_info=True)

        message = (
            "_**Feedback received** — My ego is intact and thriving, thanks._"
            if feedback_type == "positive"
            else "_**Feedback received** — Appreciated, even if it stings a little._"
        )
        renderable = SlackRenderable(
            blocks=[MarkdownBlock(text=message)], text="Feedback received..."
        )
        try:
            install.send_threaded_ephemeral_message(
                channel_id=channel_id,
                thread_ts=thread_ts,
                renderable=renderable,
                slack_user_id=reactor_slack_user_id,
            )
        except Exception:
            _logger.warning("seer.slack.process_reaction.send_ephemeral_failed", exc_info=True)
