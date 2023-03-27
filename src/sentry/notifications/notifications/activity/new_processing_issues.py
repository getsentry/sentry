from __future__ import annotations

from typing import Any, MutableMapping

from sentry.models import Activity, Mapping, NotificationSetting
from sentry.notifications.types import GroupSubscriptionReason
from sentry.notifications.utils import summarize_issues
from sentry.notifications.utils.participants import ParticipantMap
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

from .base import ActivityNotification


class NewProcessingIssuesActivityNotification(ActivityNotification):
    metrics_key = "new_processing_issues_activity"
    template_path = "sentry/emails/activity/new_processing_issues"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.issues = summarize_issues(self.activity.data["issues"])

    def get_participants_with_group_subscription_reason(self) -> ParticipantMap:
        participants_by_provider = NotificationSetting.objects.get_notification_recipients(
            self.project
        )
        result = ParticipantMap()
        for provider, participants in participants_by_provider.items():
            for participant in participants:
                result.add(provider, participant, GroupSubscriptionReason.processing_issue)
        return result

    def get_message_description(self, recipient: RpcActor, provider: ExternalProviders) -> str:
        return f"Some events failed to process in your project {self.project.slug}"

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            **self.get_base_context(),
            "project": self.project,
            "issues": self.issues,
            "reprocessing_active": self.activity.data["reprocessing_active"],
            "info_url": self.organization.absolute_url(
                f"/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/"
            ),
        }

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Processing Issues on {self.project.slug}"

    @property
    def title(self) -> str:
        return self.get_subject()

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        project_url = self.organization.absolute_url(
            f"/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/"
        )
        return f"Processing issues on {self.format_url(text=self.project.slug, url=project_url, provider=provider)}"

    def build_attachment_title(self, recipient: RpcActor) -> str:
        return self.get_subject()

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        return None
