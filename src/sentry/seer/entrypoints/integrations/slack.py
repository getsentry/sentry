from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, TypedDict

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.seer import (
    SeerAutofixError,
    SeerAutofixSuccess,
    SeerAutofixUpdate,
)
from sentry.notifications.platform.types import NotificationData, NotificationProviderKey
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.sentry_apps.metrics import SentryAppEventType

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.integrations.slack.integration import SlackIntegration
    from sentry.integrations.slack.requests import SlackActionRequest
    from sentry.models.group import Group


class SlackEntrypointCachePayload(TypedDict):
    organization_id: int
    integration_id: int
    thread_ts: str
    channel_id: str
    group_link: str


@entrypoint_registry.register(key=SeerEntrypointKey.SLACK)
class SlackEntrypoint(SeerEntrypoint[SlackEntrypointCachePayload]):
    key = SeerEntrypointKey.SLACK

    def __init__(
        self,
        slack_request: SlackActionRequest,
        group: Group,
        organization_id: int,
        autofix_stopping_point: AutofixStoppingPoint | None = None,
    ):
        from sentry.integrations.slack.integration import SlackIntegration

        self.slack_request = slack_request
        self.group = group
        self.channel_id = slack_request.channel_id or ""
        self.thread_ts = slack_request.data.get("message", {}).get("ts")
        self.organization_id = organization_id
        self.install = SlackIntegration(
            model=slack_request.integration, organization_id=organization_id
        )
        self.autofix_stopping_point = autofix_stopping_point or AutofixStoppingPoint.ROOT_CAUSE

    def on_trigger_autofix_error(self, *, error: str) -> None:
        _send_thread_update(
            install=self.install,
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            data=SeerAutofixError(error_message=error),
        )

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        _send_thread_update(
            install=self.install,
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            data=SeerAutofixSuccess(
                run_id=run_id,
                organization_id=self.organization_id,
                stopping_point=self.autofix_stopping_point,
            ),
        )

    def on_message_autofix_error(self, *, error: str) -> None:
        # TODO(Leander): Modify the original context input block?
        pass

    def on_message_autofix_success(self, *, run_id: int) -> None:
        # TODO(Leander): Add a reaction and disable the context input block?
        pass

    def create_autofix_cache_payload(self) -> SlackEntrypointCachePayload:
        return SlackEntrypointCachePayload(
            thread_ts=self.thread_ts,
            channel_id=self.channel_id,
            organization_id=self.organization_id,
            integration_id=self.install.model.id,
            group_link=self.group.get_absolute_url(),
        )

    @staticmethod
    def on_autofix_update(
        event_type: SentryAppEventType,
        event_payload: dict[str, Any],
        cache_payload: SlackEntrypointCachePayload,
    ) -> None:
        logging_ctx = {
            "event_type": event_type,
            "cache_payload": cache_payload,
        }
        integration = integration_service.get_integration(
            integration_id=cache_payload["integration_id"],
            organization_id=cache_payload["organization_id"],
            provider=IntegrationProviderSlug.SLACK.value,
            status=ObjectStatus.ACTIVE,
        )
        if not integration:
            logger.error("integration_not_found", extra=logging_ctx)
            return

        install = SlackIntegration(
            model=integration, organization_id=cache_payload["organization_id"]
        )
        update_data = SeerAutofixUpdate(
            run_id=event_payload["run_id"],
            organization_id=cache_payload["organization_id"],
            current_point=AutofixStoppingPoint.ROOT_CAUSE,
            summary=event_payload["summary"],
            steps=event_payload["steps"],
            group_link=f'{cache_payload["group_link"]}?seerDrawer=true',
        )

        match event_type:
            case SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED:
                _send_thread_update(
                    install=install,
                    channel_id=cache_payload["channel_id"],
                    thread_ts=cache_payload["thread_ts"],
                    data=update_data,
                )
                return
            case SentryAppEventType.SEER_SOLUTION_COMPLETED:
                _send_thread_update(
                    install=install,
                    channel_id=cache_payload["channel_id"],
                    thread_ts=cache_payload["thread_ts"],
                    data=update_data,
                )
            case SentryAppEventType.SEER_CODING_COMPLETED:
                _send_thread_update(
                    install=install,
                    channel_id=cache_payload["channel_id"],
                    thread_ts=cache_payload["thread_ts"],
                    data=update_data,
                )
            case SentryAppEventType.SEER_PR_CREATED:
                _send_thread_update(
                    install=install,
                    channel_id=cache_payload["channel_id"],
                    thread_ts=cache_payload["thread_ts"],
                    data=update_data,
                )
            case _:
                return


def _send_thread_update(
    *,
    install: SlackIntegration,
    channel_id: str,
    thread_ts: str,
    data: NotificationData,
) -> None:
    """
    Send a message to a Slack thread. Needs to be external to the SlackEntrypoint since
    it's used in both its instance methods and static methods
    """
    provider = provider_registry.get(NotificationProviderKey.SLACK)
    template_cls = template_registry.get(data.source)
    renderable = NotificationService.render_template(
        data=data, template=template_cls(), provider=provider
    )
    # Skip over the notification service for now since threading isn't yet formalized.
    install.send_threaded_message(channel_id=channel_id, thread_ts=thread_ts, renderable=renderable)


def encode_context_block_id(run_id: int, organization_id: int) -> str:
    from sentry.integrations.slack.message_builder.types import SlackAction

    return f"{SlackAction.SEER_CONTEXT_INPUT.value}::{organization_id}::{run_id}"


def decode_context_block_id(block_id: str) -> tuple[int, int]:
    _action, organization_id, run_id = block_id.split("::")
    return int(organization_id), int(run_id)
