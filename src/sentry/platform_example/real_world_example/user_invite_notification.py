from __future__ import annotations

from dataclasses import dataclass

from django.urls import reverse

from sentry.models.organizationmember import OrganizationMember
from sentry.platform_example.notification import NotificationService
from sentry.platform_example.notification_target import NotificationTarget, NotificationUserTarget
from sentry.platform_example.notification_target_strategies import NotificationTargetStrategy
from sentry.platform_example.notification_types import NotificationType
from sentry.platform_example.template_base import (
    DjangoNotificationTemplate,
    EmailTemplate,
    IntegrationTemplate,
    RenderedEmailTemplate,
    TemplateData,
)
from sentry.users.services.user.service import user_service


@dataclass
class OrganizationInviteNotificationData(TemplateData):
    organization_name: str
    inviter_name: str | None
    email: str
    pending_requests_link: str

    @classmethod
    def from_member_invite(
        cls, member_invite: OrganizationMember
    ) -> OrganizationInviteNotificationData:
        assert member_invite.email is not None, "A user email is required"
        inviter = None
        if member_invite.inviter_id is not None:
            inviter = user_service.get_user(member_invite.inviter_id)

        return cls(
            organization_name=member_invite.organization.name,
            inviter_name=inviter.name if inviter else "",
            email=member_invite.email,
            pending_requests_link=member_invite.organization.absolute_url(
                reverse("sentry-organization-members", args=[member_invite.organization.slug])
            ),
        )


OrganizationInviteNotificationTemplate = DjangoNotificationTemplate[
    OrganizationInviteNotificationData
](
    notification_type=NotificationType.OrganizationInvite,
    email_template=EmailTemplate(
        body_template_path="sentry/emails/organization-invite-request.html",
        body_plaintext_template_path="sentry/emails/organization-invite-request.txt",
        subject_template_path="sentry/emails/organization-invite-request-subject.txt",
    ),
    integration_template=IntegrationTemplate(
        body_template_path="sentry/integrations/organization-invite-request.txt",
        subject_template_path="sentry/integrations/organization-invite-request-subject.txt",
    ),
)


class OrganizationRoleTargetStrategy(NotificationTargetStrategy):
    organization_role: str
    organization_id: int

    def __init__(self, organization_scope: str, organization_id: int) -> None:
        super().__init__()
        self.organization_role = organization_scope
        self.organization_id = organization_id

    def get_targets(self) -> list[NotificationTarget]:
        return [
            NotificationUserTarget(
                user_id=member.user_id,
            )
            for member in self._get_organization_members_with_scope()
            if member.user_id is not None
        ]

    def _get_organization_members_with_scope(self) -> list[OrganizationMember]:
        organization_members = OrganizationMember.objects.get_contactable_members_for_org(
            self.organization_id
        )
        members = organization_members.filter(
            role__in=self.organization_role,
        )
        return list(members)


def notify_organization_invite(
    organization_id: int,
    organization_role: str,
    member_invite: OrganizationMember,
) -> None:
    data = OrganizationInviteNotificationData.from_member_invite(member_invite)

    strategy = OrganizationRoleTargetStrategy(organization_role, organization_id)
    notification_targets = strategy.get_targets()

    NotificationService.notify_many(
        targets=notification_targets,
        template=OrganizationInviteNotificationTemplate,
        data=data,
    )


def render_organization_invite_notification(
    member_invite: OrganizationMember,
) -> RenderedEmailTemplate:
    data = OrganizationInviteNotificationData.from_member_invite(member_invite)
    return OrganizationInviteNotificationTemplate.render_email_template(data)
