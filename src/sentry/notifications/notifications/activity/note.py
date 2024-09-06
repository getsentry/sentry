from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.utils.html import format_html
from django.utils.safestring import SafeString

from sentry.integrations.types import ExternalProviders
from sentry.notifications.utils.avatar import avatar_as_html, get_user_avatar_url
from sentry.types.actor import Actor

from .base import GroupActivityNotification


class NoteActivityNotification(GroupActivityNotification):
    message_builder = "SlackNotificationsMessageBuilder"
    metrics_key = "note_activity"
    template_path = "sentry/emails/activity/note"

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        # Notes may contain {} characters so we should escape them.
        text = str(self.activity.data["text"]).replace("{", "{{").replace("}", "}}")
        return text, None, {}

    @property
    def title(self) -> str:
        if self.user:
            author = self.user.get_display_name()
        else:
            author = "Unknown"
        return f"New comment by {author}"

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return self.title

    def get_message_description(self, recipient: Actor, provider: ExternalProviders) -> Any:
        return self.get_context()["text_description"]

    def description_as_html(self, description: str, params: Mapping[str, Any]) -> SafeString:
        """Note emails are formatted differently from almost all other activity emails.
        Rather than passing the `description` as a string to be formatted into HTML with
        `author` and `an_issue` (see base definition and resolved.py's `get_description`
        as an example) we are simply passed the comment as a string that needs no formatting,
        and want the avatar on it's own rather than bundled with the author's display name
        because the display name is already shown in the notification title."""
        fmt = '<span class="avatar-container">{}</span>'

        if self.user:
            if self.user.get_avatar_type() == "upload":
                return format_html(
                    '<img class="avatar" src="{}">', get_user_avatar_url(self.user, 48)
                )
            return format_html(fmt, avatar_as_html(self.user, 48))
        return format_html(description)
