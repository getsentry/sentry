import logging
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Optional, Union

from django.utils.encoding import force_text

from sentry.models import Group, GroupSubscription
from sentry.notifications.helpers import get_reason_context
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.utils import send_activity_notification
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Project, Team, User

logger = logging.getLogger(__name__)


class UserReportNotification(BaseNotification):
    def __init__(self, project: "Project", report: Mapping[str, Any]) -> None:
        super().__init__(project)
        self.group = Group.objects.get(id=report["issue"]["id"])
        self.report = report

    def get_participants_with_group_subscription_reason(
        self,
    ) -> Mapping[ExternalProviders, Mapping["User", int]]:
        data_by_provider = GroupSubscription.objects.get_participants(group=self.group)
        return {
            provider: data
            for provider, data in data_by_provider.items()
            if provider in [ExternalProviders.EMAIL]
        }

    def get_filename(self) -> str:
        return "activity/new-user-feedback"

    def get_category(self) -> str:
        return "user_report_email"

    def get_type(self) -> str:
        return "notify.user-report"

    def get_subject(self, context: Optional[Mapping[str, Any]] = None) -> str:
        # Explicitly typing to satisfy mypy.
        message = f"{self.group.qualified_short_id} - New Feedback from {self.report['name']}"
        message = force_text(message)
        return message

    def get_notification_title(self) -> str:
        # This shouldn't be possible but adding a message just in case.
        return self.get_subject()

    def get_reference(self) -> Any:
        return self.project

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            "enhanced_privacy": self.organization.flags.enhanced_privacy,
            "group": self.group,
            "issue_link": absolute_uri(
                f"/{self.organization.slug}/{self.project.slug}/issues/{self.group.id}/"
            ),
            # TODO(dcramer): we don't have permalinks to feedback yet
            "link": absolute_uri(
                f"/{self.organization.slug}/{self.project.slug}/issues/{self.group.id}/feedback/"
            ),
            "project": self.project,
            "project_link": absolute_uri(f"/{self.organization.slug}/{self.project.slug}/"),
            "report": self.report,
        }

    def get_recipient_context(
        self, recipient: Union["Team", "User"], extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        return get_reason_context(extra_context)

    def send(self) -> None:
        return send_activity_notification(self)
