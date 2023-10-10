from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping

from django.utils.encoding import force_str

from sentry.db.models import Model
from sentry.models.group import Group
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.helpers import get_reason_context
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.utils import send_activity_notification
from sentry.notifications.utils.participants import ParticipantMap
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models.project import Project

logger = logging.getLogger(__name__)


class UserReportNotification(ProjectNotification):
    metrics_key = "user_report"
    template_path = "sentry/emails/activity/new-user-feedback"

    def __init__(self, project: Project, report: Mapping[str, Any]) -> None:
        super().__init__(project)
        self.group = Group.objects.get(id=report["issue"]["id"])
        self.report = report

    def get_participants_with_group_subscription_reason(self) -> ParticipantMap:
        data_by_provider = GroupSubscription.objects.get_participants(group=self.group)
        email_participants = data_by_provider.get_participants_by_provider(ExternalProviders.EMAIL)

        result = ParticipantMap()
        for (actor, reason) in email_participants:
            result.add(ExternalProviders.EMAIL, actor, reason)
        return result

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        message = f"{self.group.qualified_short_id} - New Feedback from {self.report['name']}"
        message = force_str(message)
        return message

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return self.get_subject(context)

    @property
    def reference(self) -> Model | None:
        return self.project

    def get_context(self) -> MutableMapping[str, Any]:
        organization = self.organization
        link_query = f"project={self.project.id}"
        if hasattr(self, "notification_uuid"):
            link_query += f"&amp;notification_uuid={self.notification_uuid}"
        return {
            "enhanced_privacy": organization.flags.enhanced_privacy,
            "group": self.group,
            "issue_link": organization.absolute_url(
                f"/organizations/{organization.slug}/issues/{self.group.id}/",
                query=link_query,
            ),
            # TODO(dcramer): we don't have permalinks to feedback yet
            "link": organization.absolute_url(
                f"/organizations/{organization.slug}/issues/{self.group.id}/feedback/",
                query=link_query,
            ),
            "project": self.project,
            "project_link": organization.absolute_url(
                f"/organizations/{self.organization.slug}/projects/{self.project.slug}/"
            ),
            "report": self.report,
        }

    def get_recipient_context(
        self, recipient: RpcActor, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        context = super().get_recipient_context(recipient, extra_context)
        return {**context, **get_reason_context(context)}

    def send(self) -> None:
        return send_activity_notification(self)
