from __future__ import annotations

from typing import Any, MutableMapping

from sentry.models import Activity, Mapping, NotificationSetting, Team, User
from sentry.notifications.types import GroupSubscriptionReason
from sentry.notifications.utils import summarize_issues
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

from .base import ActivityNotification


class NewProcessingIssuesActivityNotification(ActivityNotification):
    referrer_base = "new-processing-issues-activity"
    template_path = "sentry/emails/activity/new_processing_issues"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.issues = summarize_issues(self.activity.data["issues"])

    def get_participants_with_group_subscription_reason(
        self,
    ) -> Mapping[ExternalProviders, Mapping[Team | User, int]]:
        participants_by_provider = NotificationSetting.objects.get_notification_recipients(
            self.project
        )
        return {
            provider: {
                participant: GroupSubscriptionReason.processing_issue
                for participant in participants
            }
            for provider, participants in participants_by_provider.items()
        }

    def get_message_description(self, recipient: Team | User) -> str:
        return f"Some events failed to process in your project {self.project.slug}"

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            **self.get_base_context(),
            "project": self.project,
            "issues": self.issues,
            "reprocessing_active": self.activity.data["reprocessing_active"],
            "info_url": absolute_uri(
                f"/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/"
            ),
        }

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Processing Issues on {self.project.slug}"

    @property
    def title(self) -> str:
        return self.get_subject()

    def get_category(self) -> str:
        return "new_processing_issues_activity_email"

    def get_notification_title(self) -> str:
        project_url = absolute_uri(
            f"/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/"
        )
        return f"Processing issues on <{self.project.slug}|{project_url}"

    def build_attachment_title(self, recipient: Team | User) -> str:
        return self.get_subject()

    def get_title_link(self, recipient: Team | User) -> str | None:
        return None
