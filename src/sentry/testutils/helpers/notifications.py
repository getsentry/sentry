from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Iterable, Mapping

from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.models import Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.types.integrations import ExternalProviders
from sentry.utils.dates import ensure_aware


class DummyNotification(BaseNotification):
    template_path = ""
    metrics_key = "dummy"
    reference = None

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        pass

    def determine_recipients(self) -> Iterable[Team | RpcUser]:
        return []

    def build_attachment_title(self, *args):
        return "My Title"

    def get_title_link(self, *args):
        return None

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return "Notification Title"

    def record_notification_sent(self, *args):
        pass

    def build_notification_footer(self, *args) -> str:
        return ""

    def get_participants(self):
        return []


class AnotherDummyNotification(DummyNotification):
    def __init__(self, organization, some_value) -> None:
        super().__init__(organization)
        self.some_value = some_value


class DummyNotificationWithMoreFields(DummyNotification):
    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        some_value = context["some_field"]
        return f"Notification Title with {some_value}"

    def build_notification_footer(self, *args):
        return "Notification Footer"

    def get_message_description(self, recipient: User | Team, provider: ExternalProviders):
        return "Message Description"

    def get_title_link(self, *args):
        from sentry.integrations.message_builder import get_title_link

        return get_title_link(self.group, None, False, True, self)


TEST_ISSUE_OCCURRENCE = IssueOccurrence(
    uuid.uuid4().hex,
    1,
    uuid.uuid4().hex,
    ["some-fingerprint"],
    "something bad happened",
    "it was bad",
    "1234",
    {"Test": 123},
    [
        IssueEvidence("Attention", "Very important information!!!", True),
        IssueEvidence("Evidence 2", "Not important", False),
        IssueEvidence("Evidence 3", "Nobody cares about this", False),
    ],
    ProfileFileIOGroupType,
    ensure_aware(datetime.now()),
    "info",
    "/api/123/",
)
