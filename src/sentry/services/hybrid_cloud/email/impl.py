from __future__ import annotations

from typing import Collection, Iterable

from sentry.models import OrganizationMember, UserEmail
from sentry.services.hybrid_cloud.email import ApiUserEmail, EmailService
from sentry.services.hybrid_cloud.organization import (
    ApiOrganization,
    ApiOrganizationMember,
    organization_service,
)
from sentry.services.hybrid_cloud.user import APIUser, user_service


class DatabaseBackedEmailService(EmailService):
    def get_user_emails(self, *, email: str) -> Iterable[ApiUserEmail]:
        user_emails: Iterable[UserEmail] = UserEmail.objects.filter(
            email__iexact=email, user__is_active=True
        )
        return (self._serialize_user_email(user_email) for user_email in user_emails)

    @classmethod
    def _serialize_user_email(cls, user_email: UserEmail) -> ApiUserEmail:
        return ApiUserEmail(
            id=user_email.id,
            user=user_service.serialize_user(user_email.user),
            email=user_email.email,
            is_verified=user_email.is_verified,
            is_primary=user_email.is_primary(),
        )

    def get_members_for_users(
        self, *, organization: ApiOrganization, users: Collection[APIUser]
    ) -> Iterable[ApiOrganizationMember]:
        members: Iterable[OrganizationMember] = (
            OrganizationMember.objects.filter(organization=organization, user__in=users)
            .values_list("user", flat=True)
            .distinct()
        )
        return (organization_service.serialize_member(member) for member in members)
