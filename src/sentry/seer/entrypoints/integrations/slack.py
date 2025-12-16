from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, TypedDict

from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.seer import SeerAutofixError, SeerContextInput
from sentry.notifications.platform.types import NotificationData, NotificationProviderKey
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.sentry_apps.metrics import SentryAppEventType

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.integrations.slack.requests import SlackActionRequest


class SlackEntrypointCachePayload(TypedDict):
    thread_ts: str
    channel_id: str


@entrypoint_registry.register(key=SeerEntrypointKey.SLACK)
class SlackEntrypoint(SeerEntrypoint[SlackEntrypointCachePayload]):
    key = SeerEntrypointKey.SLACK

    def __init__(self, slack_request: SlackActionRequest, organization_id: int):
        from sentry.integrations.slack.integration import SlackIntegration

        self.slack_request = slack_request
        self.channel_id = slack_request.channel_id or ""
        self.thread_ts = slack_request.data.get("message", {}).get("ts")
        self.organization_id = organization_id
        self.install = SlackIntegration(
            model=slack_request.integration,
            organization_id=organization_id,
        )

    def _send_thread_update(self, *, data: NotificationData) -> None:
        provider = provider_registry.get(NotificationProviderKey.SLACK)
        template_cls = template_registry.get(data.source)
        renderable = NotificationService.render_template(
            data=data, template=template_cls(), provider=provider
        )
        # Skip over the notification service for now since threading isn't yet formalized.
        self.install.send_threaded_message(
            channel_id=self.channel_id, thread_ts=self.thread_ts, renderable=renderable
        )

    def on_trigger_autofix_error(self, *, error: str) -> None:
        self._send_thread_update(data=SeerAutofixError(error_message=error))

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        self._send_thread_update(
            data=SeerContextInput(run_id=run_id, organization_id=self.organization_id)
        )

    def on_message_autofix_error(self, *, error: str) -> None:
        # TODO(Leander): Modify the original context input block?
        pass

    def on_message_autofix_success(self, *, run_id: int) -> None:
        # TODO(Leander): Add a reaction and disable the context input block?
        pass

    def setup_on_autofix_update(self) -> SlackEntrypointCachePayload:
        return SlackEntrypointCachePayload(
            thread_ts=self.thread_ts,
            channel_id=self.channel_id,
        )

    @staticmethod
    def on_autofix_update(
        event_name: SentryAppEventType,
        event_payload: dict[str, Any],
        cached_payload: SlackEntrypointCachePayload,
    ) -> None:
        # TODO(Leander): Implement this
        match event_name:
            case SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED:
                pass
            case SentryAppEventType.SEER_SOLUTION_COMPLETED:
                pass
            case SentryAppEventType.SEER_CODING_COMPLETED:
                pass
            case SentryAppEventType.SEER_PR_CREATED:
                pass
            case _:
                return


def encode_context_block_id(run_id: int, organization_id: int) -> str:
    from sentry.integrations.slack.message_builder.types import SlackAction

    return f"{SlackAction.SEER_CONTEXT_INPUT.value}::{organization_id}::{run_id}"


def decode_context_block_id(block_id: str) -> tuple[int, int]:
    _action, organization_id, run_id = block_id.split("::")
    return int(organization_id), int(run_id)
