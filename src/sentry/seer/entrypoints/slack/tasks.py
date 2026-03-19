from __future__ import annotations

import logging

from sentry.identity.services.identity import identity_service
from sentry.integrations.slack.message_builder.prompt import SlackPromptLinkMessageBuilder
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.seer.entrypoints.metrics import (
    SlackEntrypointEventLifecycleMetric,
    SlackEntrypointInteractionType,
)
from sentry.seer.entrypoints.operator import SeerExplorerOperator
from sentry.seer.entrypoints.slack.entrypoint import EntrypointSetupError, SlackExplorerEntrypoint
from sentry.seer.entrypoints.slack.mention import build_thread_context, extract_prompt
from sentry.seer.entrypoints.slack.metrics import ProcessMentionHaltReason
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)


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
    thread_ts: str,
    text: str,
    slack_user_id: str,
    bot_user_id: str,
) -> None:
    """
    Process a Slack @mention for Seer Explorer.

    Parses the mention, extracts thread context,
    and triggers an Explorer run via SeerExplorerOperator.

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
                "thread_ts": thread_ts,
                "slack_user_id": slack_user_id,
            },
        )

        try:
            organization = Organization.objects.get_from_cache(id=organization_id)
        except Organization.DoesNotExist:
            lifecycle.record_halt(halt_reason=ProcessMentionHaltReason.ORG_NOT_FOUND)
            return

        if not SlackExplorerEntrypoint.has_access(organization):
            lifecycle.record_halt(halt_reason=ProcessMentionHaltReason.NO_EXPLORER_ACCESS)
            return

        try:
            entrypoint = SlackExplorerEntrypoint(
                integration_id=integration_id,
                organization_id=organization_id,
                channel_id=channel_id,
                thread_ts=thread_ts,
                slack_user_id=slack_user_id,
            )
        except (ValueError, EntrypointSetupError) as e:
            lifecycle.record_halt(halt_reason=e)
            return

        user = _resolve_user(
            integration_external_id=entrypoint.integration.external_id,
            slack_user_id=slack_user_id,
        )
        if not user:
            _send_link_identity_prompt(entrypoint=entrypoint)
            lifecycle.record_halt(halt_reason=ProcessMentionHaltReason.IDENTITY_NOT_LINKED)
            return

        prompt = extract_prompt(text, bot_user_id)

        thread_context: str | None = None
        if thread_ts:
            messages = entrypoint.install.get_thread_history(
                channel_id=channel_id, thread_ts=thread_ts
            )
            thread_context = build_thread_context(messages) or None

        operator = SeerExplorerOperator(entrypoint=entrypoint)
        operator.trigger_explorer(
            organization=organization,
            user=user,
            prompt=prompt,
            on_page_context=thread_context,
            category_key="slack_thread",
            category_value=f"{channel_id}:{entrypoint.thread_ts}",
        )


def _resolve_user(
    *,
    integration_external_id: str,
    slack_user_id: str,
) -> RpcUser | None:
    """Resolve the Sentry user from a Slack user ID via linked identity."""
    provider = identity_service.get_provider(
        provider_type=IntegrationProviderSlug.SLACK.value,
        provider_ext_id=integration_external_id,
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


def _send_link_identity_prompt(
    *,
    entrypoint: SlackExplorerEntrypoint,
) -> None:
    """Send an ephemeral message prompting the user to link their Slack identity to Sentry."""
    associate_url = build_linking_url(
        integration=entrypoint.integration,
        slack_id=entrypoint.slack_user_id,
        channel_id=entrypoint.channel_id,
        response_url=None,
    )
    client = SlackSdkClient(integration_id=entrypoint.integration.id)
    builder = SlackPromptLinkMessageBuilder(associate_url)
    client.chat_postEphemeral(
        channel=entrypoint.channel_id,
        user=entrypoint.slack_user_id,
        text="Link your Slack identity to Sentry to use this feature.",
        **builder.as_payload(),
    )
