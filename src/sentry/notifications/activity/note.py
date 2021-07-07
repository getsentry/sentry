from typing import Any, MutableMapping

from .base import ActivityNotification


class NoteActivityNotification(ActivityNotification):
    def get_context(self) -> MutableMapping[str, Any]:
        return {
            **self.get_base_context(),
            "text_description": str(self.activity.data["text"]),
        }

    def get_filename(self) -> str:
        return "activity/note"

    def get_category(self) -> str:
        return "note_activity_email"

    def get_author(self) -> Any:
        return self.activity.user.get_display_name()

    def get_title(self) -> str:
        return f"New comment by {self.get_author()}"

    def get_notification_title(self) -> str:
        group_url = self.activity.group.get_absolute_url(params={"referrer": "slack"})
        text = f"<{group_url}|{self.activity.group.qualified_short_id}>"
        return f"{self.get_author()} commented on {text}"
