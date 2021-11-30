from __future__ import annotations

from typing import Any, Callable

from sentry.models import Integration, Organization

from .message_builder import SlackBody

# TODO(Steve): Fix types
GetAttachment = Callable[[Any, Any], SlackBody]


class AdditionalAttachmentManager:
    def __init__(self) -> None:
        self.attachment_generator: GetAttachment | None = None

    def get_additional_attachment(
        self,
        integration: Integration,
        organization: Organization,
    ) -> SlackBody | None:
        if self.attachment_generator is None:
            return None
        return self.attachment_generator(integration, organization)

    def register_additional_attachment_generator(
        self,
        attachment_generator: GetAttachment,
    ) -> None:
        self.attachment_generator = attachment_generator
