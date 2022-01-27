from __future__ import annotations

from typing import TYPE_CHECKING, Any, Mapping

from .base import GroupActivityNotification

if TYPE_CHECKING:
    from sentry.models import Team, User


class NoteActivityNotification(GroupActivityNotification):
    message_builder = "SlackNotificationsMessageBuilder"
    referrer_base = "note-activity"

    def get_activity_name(self) -> str:
        return "Note"

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return str(self.activity.data["text"]), {}, {}

    def get_filename(self) -> str:
        return "activity/note"

    def get_category(self) -> str:
        return "note_activity_email"

    def get_title(self) -> str:
        author = self.activity.user.get_display_name()
        return f"New comment by {author}"

    def get_notification_title(self) -> str:
        return self.get_title()

    def get_message_description(self, recipient: Team | User) -> Any:
        return self.get_context()["text_description"]
