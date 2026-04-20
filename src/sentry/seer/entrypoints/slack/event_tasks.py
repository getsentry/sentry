"""
Control-silo orchestrator tasks for Seer Slack events.

Slack gives us a 3-second window to ack a webhook. Organization resolution and the
``assistant_threads_setStatus`` / ``setSuggestedPrompts`` Slack calls each add
latency that can push a request over that budget. The parser 200s immediately and
enqueues one of these tasks, which does the resolution + Slack API work + (for
mentions) enqueues ``process_mention_for_slack``.
"""

from __future__ import annotations

import logging

from taskbroker_client.retry import Retry

from sentry.constants import ObjectStatus
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
    SeerSlackHaltReason,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.integration import SlackIntegration
from sentry.integrations.slack.requests.event import resolve_seer_organization_for_slack_user
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.seer.entrypoints.slack.messaging import send_identity_link_prompt
from sentry.seer.entrypoints.slack.tasks import process_mention_for_slack
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_control_tasks

logger = logging.getLogger(__name__)

_SEER_STARTING_PROMPTS = [
    {
        "title": "👾  What's breaking right now?",
        "message": "What are the most critical unresolved errors happening in my projects right now?",
    },
    {
        "title": "⚡️  Locate the bottlenecks",
        "message": "Find the slowest endpoints and biggest performance bottlenecks in the last 24 hours.",
    },
    {
        "title": "🛰  Run a diagnostics scan",
        "message": "Give me a full health summary of my projects — top errors, performance trends, and anything that needs attention.",
    },
    {
        "title": "🪐  Weekly mission debrief",
        "message": "Summarize what's broken, improved and any notable changes across my projects over the last 7 days.",
    },
]
_SEER_LOADING_MESSAGES = [
    "Digging through your errors...",
    "Sifting through stack traces...",
    "Blaming the right code...",
    "Following the breadcrumbs...",
    "Asking the stack trace nicely...",
    "Reading between the stack frames...",
    "Hold on, I've seen this one before...",
    "It worked on my machine...",
]


@instrumented_task(
    name="sentry.seer.entrypoints.slack.handle_seer_mention_event",
    namespace=integrations_control_tasks,
    processing_deadline_duration=30,
    retry=Retry(times=2, delay=30),
    silo_mode=SiloMode.CONTROL,
)
def handle_seer_mention_event(
    *,
    integration_id: int,
    channel_id: str,
    slack_user_id: str,
    text: str,
    ts: str,
    thread_ts: str | None,
    bot_user_id: str,
) -> None:
    """
    Orchestrate an ``app_mention`` or assistant-scope DM event.

    Resolves the target org (or prompts identity linking), sets the "Thinking…"
    status in the thread, and hands off to ``process_mention_for_slack``.
    """
    with MessagingInteractionEvent(
        interaction_type=MessagingInteractionType.APP_MENTION,
        spec=SlackMessagingSpec(),
    ).capture() as lifecycle:
        lifecycle.add_extras(
            {
                "integration_id": integration_id,
                "channel_id": channel_id,
                "ts": ts,
                "thread_ts": thread_ts,
                "slack_user_id": slack_user_id,
            }
        )

        integration = integration_service.get_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        if integration is None:
            lifecycle.record_halt(SeerSlackHaltReason.NO_VALID_INTEGRATION)
            return

        result = resolve_seer_organization_for_slack_user(
            integration=integration, slack_user_id=slack_user_id
        )
        if result.error_reason:
            lifecycle.record_halt(result.error_reason)
            if result.error_reason == SeerSlackHaltReason.IDENTITY_NOT_LINKED:
                send_identity_link_prompt(
                    integration=integration,
                    slack_user_id=slack_user_id,
                    channel_id=channel_id,
                    thread_ts=thread_ts,
                )
            return

        organization_id = result.organization_id
        if organization_id is None:
            return

        if not channel_id or not text or not ts or not slack_user_id:
            lifecycle.record_halt(SeerSlackHaltReason.MISSING_EVENT_DATA)
            return

        installation = integration.get_installation(organization_id=organization_id)
        if isinstance(installation, SlackIntegration):
            installation.set_thread_status(
                channel_id=channel_id,
                thread_ts=thread_ts or ts,
                status="Thinking...",
                loading_messages=_SEER_LOADING_MESSAGES,
            )

        process_mention_for_slack.apply_async(
            kwargs={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "channel_id": channel_id,
                "ts": ts,
                "thread_ts": thread_ts,
                "text": text,
                "slack_user_id": slack_user_id,
                "bot_user_id": bot_user_id,
            }
        )


@instrumented_task(
    name="sentry.seer.entrypoints.slack.handle_seer_assistant_thread_started_event",
    namespace=integrations_control_tasks,
    processing_deadline_duration=30,
    retry=Retry(times=2, delay=30),
    silo_mode=SiloMode.CONTROL,
)
def handle_seer_assistant_thread_started_event(
    *,
    integration_id: int,
    channel_id: str,
    slack_user_id: str,
    thread_ts: str,
) -> None:
    """
    Orchestrate an ``assistant_thread_started`` event.

    Resolves the target org (or sends the welcome identity-link prompt) and populates the
    assistant thread with suggested prompts.
    """
    with MessagingInteractionEvent(
        interaction_type=MessagingInteractionType.ASSISTANT_THREAD_STARTED,
        spec=SlackMessagingSpec(),
    ).capture() as lifecycle:
        lifecycle.add_extras(
            {
                "integration_id": integration_id,
                "channel_id": channel_id,
                "thread_ts": thread_ts,
                "slack_user_id": slack_user_id,
            }
        )

        integration = integration_service.get_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        if integration is None:
            lifecycle.record_halt(SeerSlackHaltReason.NO_VALID_INTEGRATION)
            return

        result = resolve_seer_organization_for_slack_user(
            integration=integration, slack_user_id=slack_user_id
        )
        if result.error_reason:
            lifecycle.record_halt(result.error_reason)
            if result.error_reason == SeerSlackHaltReason.IDENTITY_NOT_LINKED:
                send_identity_link_prompt(
                    integration=integration,
                    slack_user_id=slack_user_id,
                    channel_id=channel_id,
                    thread_ts=thread_ts,
                    is_welcome_message=True,
                )
            return

        organization_id = result.organization_id
        if organization_id is None:
            return

        if not channel_id or not thread_ts:
            lifecycle.record_halt(SeerSlackHaltReason.MISSING_EVENT_DATA)
            return

        installation = integration.get_installation(organization_id=organization_id)
        if not isinstance(installation, SlackIntegration):
            return

        installation.set_suggested_prompts(
            channel_id=channel_id,
            thread_ts=thread_ts,
            title="Hi there! I'm Seer, Sentry's AI assistant. How can I help?",
            prompts=_SEER_STARTING_PROMPTS,
        )
