from __future__ import annotations

from typing import Any, Mapping

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


class SlackNotificationsMessageBuilder(SlackMessageBuilder):
    def __init__(
        self,
        notification: BaseNotification,
        context: Mapping[str, Any],
        recipient: RpcActor,
    ) -> None:
        super().__init__()
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def build(self) -> SlackBody:
        callback_id_raw = self.notification.get_callback_data()
        return self._build(
            title=self.notification.build_attachment_title(self.recipient),
            title_link=self.notification.get_title_link(self.recipient, ExternalProviders.SLACK),
            text=self.notification.get_message_description(self.recipient, ExternalProviders.SLACK),
            footer=self.notification.build_notification_footer(
                self.recipient, ExternalProviders.SLACK
            ),
            actions=self.notification.get_message_actions(self.recipient, ExternalProviders.SLACK),
            callback_id=json.dumps(callback_id_raw) if callback_id_raw else None,
        )
