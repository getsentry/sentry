from typing import Any, MutableMapping

from .base import ActivityNotification


class NoteActivityNotification(ActivityNotification):
    is_message_issue_unfurl = False

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            **self.get_base_context(),
            "text_description": str(self.activity.data["text"]),
        }

    def get_filename(self) -> str:
        return "activity/note"

    def get_category(self) -> str:
        return "note_activity_email"

    def get_title(self) -> str:
        author = self.activity.user.get_display_name()
        return f"New comment by {author}"

    def get_notification_title(self) -> str:
        return self.get_title()

    def get_message_description(self) -> Any:
        return self.get_context()["text_description"]
