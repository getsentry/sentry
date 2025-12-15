from __future__ import annotations

import logging
from typing import TYPE_CHECKING, TypedDict

from sentry.models.group import Group
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.seer import SeerAutofixError, SeerContextInput
from sentry.notifications.platform.types import NotificationData, NotificationProviderKey
from sentry.seer.entrypoints.operator import SeerOperator
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.integrations.slack.webhooks.action import SlackActionRequest


class SlackEntrypointCachePayload(TypedDict):
    thread_ts: str
    channel_id: str


@entrypoint_registry.register(key=SeerEntrypointKey.SLACK)
class SlackEntrypoint(SeerEntrypoint[SlackEntrypointCachePayload]):
    key = SeerEntrypointKey.SLACK

    def __init__(self, slack_request: SlackActionRequest, organization_id: int):
        self.slack_request = slack_request
        self.install = slack_request.integration.get_installation(organization_id=organization_id)
        self.channel_id = slack_request.channel_id
        self.thread_ts = slack_request.data.get("message", {}).get("ts")
        self.organization_id = organization_id

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
        self._send_thread_update(data=SeerContextInput(run_id=run_id))

    def setup_on_autofix_update(self) -> SlackEntrypointCachePayload:
        return SlackEntrypointCachePayload(
            thread_ts=self.thread_ts,
            channel_id=self.channel_id,
        )

    @staticmethod
    def on_autofix_update(cached_payload: SlackEntrypointCachePayload) -> None:
        # TODO(leander): Implement this...
        pass


def handle_autofix_start(
    slack_request: SlackActionRequest, group: Group, user: User | RpcUser
) -> None:
    entrypoint = SlackEntrypoint(
        slack_request=slack_request, organization_id=group.project.organization_id
    )
    operator = SeerOperator(entrypoint=entrypoint)
    operator.start_autofix(group=group, user=user)
