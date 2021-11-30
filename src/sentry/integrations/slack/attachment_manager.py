from __future__ import annotations

from typing import Any, Callable, Mapping

from sentry.models import Integration, Team, User
from sentry.notifications.notifications.base import BaseNotification

from .message_builder import SlackBody
from .message_builder.notifications import get_message_builder

# TODO(Steve): Fix types of Integration and User | Team
GetAttachment = Callable[[Any, BaseNotification, Any, Mapping[str, Any]], SlackBody]


def default_get_attachments(
    notification: BaseNotification,
    recipient: Team | User,
    context: Mapping[str, Any],
) -> SlackBody:
    klass = get_message_builder(notification.message_builder)
    attachments = klass(notification, context, recipient).build()
    if isinstance(attachments, dict):
        return [attachments]
    return attachments


class AttachmentManager:
    def __init__(self) -> None:
        self.attachment_generator: GetAttachment | None = None

    def get_attachments(
        self,
        integration: Integration,
        notification: BaseNotification,
        recipient: Team | User,
        context: Mapping[str, Any],
    ) -> SlackBody:
        if self.attachment_generator is None:
            return default_get_attachments(notification, recipient, context)
        return self.attachment_generator(integration, notification, recipient, context)

    def register_additional_attachment_generator(
        self,
        attachment_generator: GetAttachment,
    ) -> None:
        self.attachment_generator = attachment_generator
