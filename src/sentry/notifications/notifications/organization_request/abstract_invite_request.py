from __future__ import annotations

import abc
from collections.abc import Mapping, MutableMapping, Sequence
from typing import TYPE_CHECKING, Any

from django.urls import reverse

from sentry.integrations.types import ExternalProviders
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.notifications.strategies.member_write_role_recipient_strategy import (
    MemberWriteRoleRecipientStrategy,
)
from sentry.notifications.utils.actions import MessageAction
from sentry.types.actor import Actor
from sentry.users.services.user.service import user_service

if TYPE_CHECKING:
    from sentry.users.models.user import User


# Abstract class for invite and join requests to inherit from
class AbstractInviteRequestNotification(OrganizationRequestNotification, abc.ABC):
    RoleBasedRecipientStrategyClass = MemberWriteRoleRecipientStrategy

    def __init__(self, pending_member: OrganizationMember, requester: User):
        super().__init__(pending_member.organization, requester)
        self.pending_member = pending_member

    @property
    def members_url(self) -> str:
        return str(
            self.organization.absolute_url(
                reverse("sentry-organization-members", args=[self.organization.slug])
            )
        )

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Access request to {self.organization.name}"

    def get_recipient_context(
        self, recipient: Actor, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        context = super().get_recipient_context(recipient, extra_context)
        context["email"] = self.pending_member.email
        context["organization_name"] = self.organization.name
        sentry_query_params = self.get_sentry_query_params(ExternalProviders.EMAIL, recipient)
        context["pending_requests_link"] = self.members_url + sentry_query_params
        if self.pending_member.requested_to_join:
            context["settings_link"] = self.organization.absolute_url(
                reverse("sentry-organization-settings", args=[self.organization.slug]),
                query=sentry_query_params,
            )
        else:
            inviter_name = ""
            if self.pending_member.inviter_id is not None:
                inviter = user_service.get_user(user_id=self.pending_member.inviter_id)
            else:
                inviter = None
            if inviter:
                context["inviter_name"] = inviter.get_salutation_name()
            context["inviter_name"] = inviter_name
        return context

    def get_message_actions(
        self, recipient: Actor, provider: ExternalProviders
    ) -> Sequence[MessageAction]:
        members_url = self.members_url + self.get_sentry_query_params(provider, recipient)
        return [
            MessageAction(
                name="Approve",
                style="primary",
                action_id="approve_request",
                value="approve_member",
                label="Approve",
            ),
            MessageAction(
                name="Reject",
                style="danger",
                action_id="reject_request",
                value="reject_member",
                label="Reject",
            ),
            MessageAction(
                name="See Members & Requests",
                url=members_url,
            ),
        ]

    def get_callback_data(self) -> Mapping[str, Any]:
        return {"member_id": self.pending_member.id, "member_email": self.pending_member.email}

    def get_log_params(self, recipient: Actor) -> MutableMapping[str, Any]:
        # TODO: figure out who the user should be when pending_member.inviter_id is None
        return {
            **super().get_log_params(recipient),
            "user_id": self.pending_member.inviter_id if self.pending_member.inviter_id else None,
            "invited_member_id": self.pending_member.id,
        }
