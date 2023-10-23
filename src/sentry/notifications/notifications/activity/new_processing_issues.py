from __future__ import annotations

from typing import Any, Mapping, MutableMapping
from urllib.parse import urlencode

from sentry.models.activity import Activity
from sentry.models.notificationsetting import NotificationSetting
from sentry.notifications.helpers import should_use_notifications_v2
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.types import GroupSubscriptionReason, NotificationSettingEnum
from sentry.notifications.utils import summarize_issues
from sentry.notifications.utils.participants import ParticipantMap
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.integrations import ExternalProviders

from .base import ActivityNotification


class NewProcessingIssuesActivityNotification(ActivityNotification):
    metrics_key = "new_processing_issues_activity"
    template_path = "sentry/emails/activity/new_processing_issues"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.issues = summarize_issues(self.activity.data["issues"])

    def get_participants_with_group_subscription_reason(self) -> ParticipantMap:
        participants_by_provider = None
        if should_use_notifications_v2(self.project.organization):
            user_ids = list(self.project.member_set.values_list("user_id", flat=True))
            users = user_service.get_many(filter={"user_ids": user_ids})
            notification_controller = NotificationController(
                recipients=users,
                project_ids=[self.project.id],
                organization_id=self.project.organization_id,
            )
            participants_by_provider = notification_controller.get_notification_recipients(
                type=NotificationSettingEnum.WORKFLOW,
            )
        else:
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
                f"/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/",
                query=urlencode(
                    {"referrer": self.metrics_key, "notification_uuid": self.notification_uuid}
                ),
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
            f"/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/",
            query=urlencode(
                {"referrer": self.metrics_key, "notification_uuid": self.notification_uuid}
            ),
        )
        return f"Processing issues on {self.format_url(text=self.project.slug, url=project_url, provider=provider)}"

    def build_attachment_title(self, recipient: RpcActor) -> str:
        return self.get_subject()

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        return None
