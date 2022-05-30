from __future__ import annotations

from typing import Any, Iterable, Mapping

from sentry.models import Team, User
from sentry.notifications.notifications.base import BaseNotification


class DummyNotification(BaseNotification):
    template_path = ""
    metrics_key = "dummy"
    reference = None

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        pass

    def determine_recipients(self) -> Iterable[Team | User]:
        return []

    def build_attachment_title(self, *args):
        return "My Title"

    def get_title_link(self, *args):
        return None

    def get_notification_title(self, context: Mapping[str, Any] | None = None) -> str:
        return "Notification Title"

    def record_notification_sent(self, *args):
        pass

    def build_notification_footer(self, *args):
        return ""

    def get_participants(self):
        return []


class AnotherDummyNotification(DummyNotification):
    def __init__(self, organization, some_value) -> None:
        super().__init__(organization)
        self.some_value = some_value
