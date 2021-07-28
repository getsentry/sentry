from typing import Any, MutableMapping, Optional, Tuple

from sentry.models import Activity, Mapping, NotificationSetting, User
from sentry.notifications.types import GroupSubscriptionReason
from sentry.notifications.utils import summarize_issues
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

from .base import GroupActivityNotification


class NewProcessingIssuesActivityNotification(GroupActivityNotification):
    is_message_issue_unfurl = False

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.issues = summarize_issues(self.activity.data["issues"])

    def get_participants_with_group_subscription_reason(
        self,
    ) -> Mapping[ExternalProviders, Mapping[User, int]]:
        users_by_provider = NotificationSetting.objects.get_notification_recipients(self.project)
        return {
            provider: {user: GroupSubscriptionReason.processing_issue for user in users}
            for provider, users in users_by_provider.items()
        }

    def get_activity_name(self) -> str:
        # TODO MARCOS make sure this doesn't cause an error
        return "New Processing Issues"

    def get_description(self) -> Tuple[str, Mapping[str, Any], Mapping[str, Any]]:
        return f"Some events failed to process in your project {self.project.slug}", {}, {}

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            **super().get_context(),
            "project": self.project,
            "issues": self.issues,
            "reprocessing_active": self.activity.data["reprocessing_active"],
            "info_url": absolute_uri(
                f"/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/"
            ),
        }

    def get_subject(self, context: Optional[Mapping[str, Any]] = None) -> str:
        return f"Processing Issues on {self.project.slug}"

    def get_title(self) -> str:
        return self.get_subject()

    def get_filename(self) -> str:
        return "activity/new_processing_issues"

    def get_category(self) -> str:
        return "new_processing_issues_activity_email"

    def get_notification_title(self) -> str:
        project_url = absolute_uri(
            f"/settings/{self.organization.slug}/projects/{self.project.slug}/processing-issues/"
        )
        return f"Processing issues on <{self.project.slug}|{project_url}"

    def get_message_description(self) -> Any:
        return self.get_context()["text_description"]
