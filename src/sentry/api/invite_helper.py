from __future__ import annotations

from dataclasses import dataclass
from logging import Logger
from typing import Any, Dict

from django.utils.crypto import constant_time_compare
from rest_framework.request import Request

from sentry import features
from sentry.models import (
    Authenticator,
    AuthIdentity,
    AuthProvider,
    Organization,
    OrganizationMember,
    User,
    UserEmail,
)
from sentry.services.hybrid_cloud.user import APIUser
from sentry.signals import member_joined
from sentry.utils import metrics


def add_invite_details_to_session(request: Request, member_id: int, token: str) -> None:
    """Add member ID and token to the request session"""
    request.session["invite_token"] = token
    request.session["invite_member_id"] = member_id


def remove_invite_details_from_session(request: Request) -> None:
    """Deletes invite details from the request session"""
    request.session.pop("invite_member_id", None)
    request.session.pop("invite_token", None)


@dataclass(frozen=True, eq=True)
class InviteDetail:
    token: str | None
    member_id: int | None
    user_id: int | None
    is_authenticated: bool
    is_verified: bool


def get_invite_details(request: Request) -> InviteDetail:
    """Extracts invite details from request session"""
    user = request.user
    primary_email = UserEmail.objects.get_primary_email(user) if isinstance(user, User) else None

    return InviteDetail(
        token=request.session.get("invite_token", None),
        member_id=request.session.get("invite_member_id", None),
        user_id=user.id,
        is_authenticated=user.is_authenticated,
        is_verified=primary_email.is_verified if primary_email else False,
    )


class ApiInviteHelper:
    @classmethod
    def from_session_or_email(
        cls,
        detail: InviteDetail,
        organization: Organization,
        email: str,
        instance: Any | None = None,
        logger: Logger | None = None,
    ) -> ApiInviteHelper | None:
        """
        Initializes the ApiInviteHelper by locating the pending organization
        member via the currently set pending invite details in the session, or
        via the passed email if no cookie is currently set.
        """
        try:
            if detail.token and detail.member_id:
                om = OrganizationMember.objects.get(token=detail.token, id=detail.member_id)
            else:
                om = OrganizationMember.objects.get(
                    email=email, organization=organization, user=None
                )
        except OrganizationMember.DoesNotExist:
            # Unable to locate the pending organization member. Cannot setup
            # the invite helper.
            return None

        return cls(detail=detail, member_id=om.id, token=om.token, instance=instance, logger=logger)

    @classmethod
    def from_session(
        cls,
        request: Request,
        instance: Any | None = None,
        logger: Logger | None = None,
    ) -> ApiInviteHelper | None:
        detail = get_invite_details(request)

        if not detail.token or not detail.member_id:
            return None

        try:
            return ApiInviteHelper(
                detail=detail,
                member_id=detail.member_id,
                token=detail.token,
                instance=instance,
                logger=logger,
            )
        except OrganizationMember.DoesNotExist:
            if logger:
                logger.error("Invalid pending invite cookie", exc_info=True)
            return None

    def __init__(
        self,
        detail: InviteDetail,
        member_id: int,
        token: str | None,
        instance: Any | None = None,
        logger: Logger | None = None,
    ) -> None:
        if detail.member_id is not None and detail.member_id != member_id:
            raise ValueError("Mismatched member_id")
        if detail.token is not None and detail.token != token:
            raise ValueError("Mismatched token")

        self.detail = detail
        self.member_id = member_id
        self.token = token
        self.instance = instance
        self.logger = logger
        self.om = self.organization_member
        self.organization = self.om.organization

    def handle_success(self) -> None:
        member_joined.send_robust(
            member=self.om,
            organization=self.organization,
            sender=self.instance if self.instance else self,
        )

    def handle_member_already_exists(self) -> None:
        if self.logger:
            self.logger.info(
                "Pending org invite not accepted - User already org member",
                extra={"organization_id": self.organization.id, "user_id": self.detail.user_id},
            )

    def handle_member_has_no_sso(self) -> None:
        if self.logger:
            self.logger.info(
                "Pending org invite not accepted - User did not have SSO",
                extra={"organization_id": self.organization.id, "user_id": self.detail.user_id},
            )

    def handle_invite_not_approved(self) -> None:
        if not self.invite_approved:
            self.om.delete()

    @property
    def organization_member(self) -> OrganizationMember:
        return OrganizationMember.objects.select_related("organization").get(pk=self.member_id)

    @property
    def member_pending(self) -> bool:
        return self.om.is_pending  # type: ignore[no-any-return]

    @property
    def invite_approved(self) -> bool:
        return self.om.invite_approved  # type: ignore[no-any-return]

    @property
    def valid_token(self) -> bool:
        if self.token is None:
            return False
        if self.om.token_expired:
            return False
        tokens_are_equal = constant_time_compare(self.om.token or self.om.legacy_token, self.token)
        return tokens_are_equal  # type: ignore[no-any-return]

    @property
    def user_authenticated(self) -> bool:
        return self.detail.is_authenticated  # type: ignore[no-any-return]

    @property
    def member_already_exists(self) -> bool:
        if not self.user_authenticated:
            return False

        query = OrganizationMember.objects.filter(
            organization=self.organization, user_id=self.detail.user_id
        )
        return query.exists()  # type: ignore[no-any-return]

    @property
    def valid_request(self) -> bool:
        return (
            self.member_pending
            and self.invite_approved
            and self.valid_token
            and self.user_authenticated
            and not any(self.get_onboarding_steps().values())
        )

    def accept_invite(self, user: APIUser | None = None) -> OrganizationMember | None:
        om = self.om
        user_id = user.id if user else self.detail.user_id

        if self.member_already_exists:
            self.handle_member_already_exists()
            om.delete()
            return None

        try:
            provider = AuthProvider.objects.get(organization=om.organization)
        except AuthProvider.DoesNotExist:
            provider = None

        # If SSO is required, check for valid AuthIdentity
        if provider and not provider.flags.allow_unlinked:
            # AuthIdentity has a unique constraint on provider and user
            if not AuthIdentity.objects.filter(auth_provider=provider, user_id=user_id).exists():
                self.handle_member_has_no_sso()
                return None

        om.set_user_by_id(user_id)
        om.save()

        # TODO: Fix this
        # create_audit_entry(
        #     self.request,
        #     actor=user,
        #     organization=om.organization,
        #     target_object=om.id,
        #     target_user=user,
        #     event=audit_log.get_event_id("MEMBER_ACCEPT"),
        #     data=om.get_audit_log_data(),
        # )

        self.handle_success()
        metrics.incr("organization.invite-accepted", sample_rate=1.0)

        return om

    def _needs_2fa(self) -> bool:
        org_requires_2fa = self.organization.flags.require_2fa.is_set
        user_has_2fa = Authenticator.objects.user_has_2fa(self.detail.user_id)
        return org_requires_2fa and not user_has_2fa

    def _needs_email_verification(self) -> bool:
        return (
            features.has("organizations:required-email-verification", self.organization)
            and self.organization.flags.require_email_verification
            and not self.detail.is_verified
        )

    def get_onboarding_steps(self) -> Dict[str, bool]:
        return {
            "needs2fa": self._needs_2fa(),
            "needsEmailVerification": self._needs_email_verification(),
        }
