from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Sequence

from django.urls import reverse

from sentry import analytics, roles
from sentry.models import InviteStatus, OrganizationMember
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.utils.actions import MessageAction
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Team, User


# Abstract class for invite and join requests to inherit from
class AbstractInviteRequestNotification(OrganizationRequestNotification):
    def __init__(self, pending_member: OrganizationMember, requester: User):
        super().__init__(pending_member.organization, requester)
        self.pending_member = pending_member

    def get_type(self) -> str:
        return "organization.invite-request"

    def get_category(self) -> str:
        return "organization_invite_request"

    @property
    def members_url(self) -> str:
        url: str = absolute_uri(reverse("sentry-organization-members", args=[self.org_slug]))
        return url

    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        members: Iterable[OrganizationMember] = OrganizationMember.objects.select_related(
            "user"
        ).filter(
            organization_id=self.organization.id,
            user__isnull=False,
            invite_status=InviteStatus.APPROVED.value,
            role__in=(r.id for r in roles.get_all() if r.has_scope("member:write")),
        )
        return members

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Access request to {self.org_name}"

    def get_recipient_context(
        self, recipient: Team | User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        context = super().get_recipient_context(recipient, extra_context)
        context["email"] = self.pending_member.email
        context["organization_name"] = self.org_name
        context["pending_requests_link"] = self.members_url + self.get_sentry_query_params(
            ExternalProviders.EMAIL
        )
        if self.pending_member.requested_to_join:
            context["settings_link"] = absolute_uri(
                reverse("sentry-organization-settings", args=[self.org_slug])
            )
        else:
            context["inviter_name"] = self.pending_member.inviter.get_salutation_name
        return context

    def get_message_actions(self) -> Sequence[MessageAction]:
        members_url = self.members_url + self.get_sentry_query_params(ExternalProviders.SLACK)
        return [
            MessageAction(
                name="Approve",
                style="primary",
                action_id="approve_request",
                value="approve_member",
            ),
            MessageAction(
                name="Reject", style="danger", action_id="approve_request", value="reject_member"
            ),
            MessageAction(
                name="See Members & Requests",
                url=members_url,
            ),
        ]

    def get_callback_data(self) -> Mapping[str, Any]:
        return {"member_id": self.pending_member.id, "member_email": self.pending_member.email}

    def record_notification_sent(self, recipient: Team | User, provider: ExternalProviders) -> None:
        analytics.record(
            self.analytics_event,
            organization_id=self.organization.id,
            user_id=self.pending_member.inviter.id if self.pending_member.inviter else None,
            target_user_id=recipient.id,
            invited_member_id=self.pending_member.id,
            providers=provider.name.lower(),
        )
