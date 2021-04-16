from typing import Any, MutableMapping

from .base import ActivityNotification


class NoteActivityNotification(ActivityNotification):
    def get_context(self) -> MutableMapping[str, Any]:
        return {}

    def get_template(self) -> str:
        return "sentry/emails/activity/note.txt"

    def get_html_template(self) -> str:
        return "sentry/emails/activity/note.html"

    def get_category(self) -> str:
        return "note_activity_email"

    def get_dm_title(self) -> str:
        author = self.get_base_context()["author"].get_display_name()
        return f"New comment by {author}"

    def get_dm_text(self) -> str:
        context = self.get_base_context()
        context.update(self.get_context())
        return str(context["data"]["text"])
