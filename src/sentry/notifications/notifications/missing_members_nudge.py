from __future__ import annotations

from typing import Any, Iterable, Mapping, MutableMapping, Optional

from django.db.models import QuerySet

from sentry.models.commitauthor import CommitAuthor
from sentry.models.organization import Organization
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.strategies.member_write_role_recipient_strategy import (
    MemberWriteRoleRecipientStrategy,
)
from sentry.notifications.types import NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders


class MissingMembersNudgeNotification(BaseNotification):
    metrics_key = "missing_members_nudge"
    analytics_event = "missing_members_nudge.sent"
    template_path = "sentry/emails/missing-members-nudge"

    RoleBasedRecipientStrategyClass = MemberWriteRoleRecipientStrategy
    notification_setting_type = NotificationSettingTypes.MISSING_MEMBERS
    reference = CommitAuthor

    def __init__(
        self,
        organization: Organization,
        commit_authors: QuerySet[CommitAuthor],
    ) -> None:
        super().__init__(organization)
        self.commit_authors = commit_authors
        self.role_based_recipient_strategy = self.RoleBasedRecipientStrategyClass(organization)

    # TODO
    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return "Invite your dev team to Sentry"

    def get_authors_list(self):
        authors = [
            {
                "email": commit_author.email,
                "external_id": commit_author.external_id,
                "commit_count": commit_author.commit_count,
            }
            for commit_author in self.commit_authors
        ]
        authors.sort(key=lambda k: k["commit_count"], reverse=True)
        return authors

    def get_notification_providers(self) -> Iterable[ExternalProviders]:
        # only email
        return [ExternalProviders.EMAIL]

    def get_members_list_url(
        self, provider: ExternalProviders, recipient: Optional[RpcActor] = None
    ) -> str:
        return self.organization.absolute_url(
            f"/settings/{self.organization.slug}/members/",
            query=self.get_sentry_query_params(provider, recipient),
        )

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            "organization": self.organization,
            "missing_members": self.get_authors_list()[0:3],
            "missing_member_count": len(self.commit_authors),
            "members_list_url": self.get_members_list_url(provider=ExternalProviders.EMAIL),
        }

    def determine_recipients(self) -> list[RpcActor]:
        # owners and managers have org:write
        return RpcActor.many_from_object(self.role_based_recipient_strategy.determine_recipients())
