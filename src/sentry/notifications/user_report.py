import logging
from typing import Any, Mapping, MutableMapping

from django.utils.encoding import force_text

from sentry.models import Group, GroupSubscription, Project, User
from sentry.notifications.base import BaseNotification
from sentry.notifications.notify import notify
from sentry.notifications.types import GroupSubscriptionReason
from sentry.notifications.utils.participants import split_participants_and_context
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


class UserReportNotification(BaseNotification):
    def __init__(self, project: Project, report: Mapping[str, Any]) -> None:
        group = Group.objects.get(id=report["issue"]["id"])
        super().__init__(project, group)
        self.report = report

    def get_participants_with_group_subscription_reason(
        self,
    ) -> Mapping[ExternalProviders, Mapping[User, int]]:
        # Explicitly typing to satisfy mypy.
        participants_by_provider: Mapping[
            ExternalProviders, Mapping[User, int]
        ] = GroupSubscription.objects.get_participants(group=self.group)
        return participants_by_provider

    def get_filename(self) -> str:
        return "activity/new-user-feedback"

    def get_category(self) -> str:
        return "digest_email"

    def get_subject(self) -> str:
        # Explicitly typing to satisfy mypy.
        message = f"{self.group.qualified_short_id} - New Feedback from {self.report['name']}"
        message = force_text(message)
        return message

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

    def get_user_context(
        self, user: User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        """Get user-specific context. Do not call get_context() here."""
        reason = extra_context.get("reason", 0)
        return {
            "reason": GroupSubscriptionReason.descriptions.get(
                reason, "are subscribed to this issue"
            )
        }

    def send(self) -> None:
        if not self.should_email():
            return

        provider = ExternalProviders.EMAIL
        participants_with_reasons = self.get_participants_with_group_subscription_reason().get(
            provider
        )
        if not participants_with_reasons:
            return

        # Only calculate shared context once.
        shared_context = self.get_context()

        participants, extra_context = split_participants_and_context(participants_with_reasons)
        notify(provider, self, participants, shared_context, extra_context)
