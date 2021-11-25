from __future__ import annotations

from typing import Any, Mapping

from .base import GroupActivityNotification


class NoteActivityNotification(GroupActivityNotification):
    activity_name = "Note"
    category = "note_activity_email"
    filename = "activity/note"
    message_builder = "SlackNotificationsMessageBuilder"

    def get_description(self) -> tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return str(self.activity.data["text"]), {}, {}

    def get_title(self) -> str:
        author = self.activity.user.get_display_name()
        return f"New comment by {author}"

    def get_notification_title(self) -> str:
        return self.get_title()

    def get_message_description(self) -> Any:
        return self.get_context()["text_description"]
