from __future__ import annotations

import dataclasses
from logging import Logger
from typing import Dict, Optional

from django.http.request import HttpRequest
from django.utils.crypto import constant_time_compare

from sentry import audit_log, features
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.services.hybrid_cloud.organization import (
    RpcOrganizationMember,
    RpcUserInviteContext,
    organization_service,
)
from sentry.signals import member_joined
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry


def add_invite_details_to_session(
    request: HttpRequest, member_id: int, token: str, organization_id: int
) -> None:
    """Add member ID and token to the request session"""
    request.session["invite_token"] = token
    request.session["invite_member_id"] = member_id
    request.session["invite_organization_id"] = organization_id


def remove_invite_details_from_session(request: HttpRequest) -> None:
    """Deletes invite details from the request session"""
    request.session.pop("invite_member_id", None)
    request.session.pop("invite_token", None)
    request.session.pop("invite_organization_id", None)


@dataclasses.dataclass
class InviteDetails:
    invite_token: Optional[str]
    invite_member_id: Optional[int]
    invite_organization_id: Optional[int]


def get_invite_details(request: HttpRequest) -> InviteDetails:
    """Returns tuple of (token, member_id) from request session"""
    return InviteDetails(
        invite_token=request.session.get("invite_token", None),
        invite_member_id=request.session.get("invite_member_id", None),
        invite_organization_id=request.session.get("invite_organization_id"),
    )


class ApiInviteHelper:
    @classmethod
    def from_session_or_email(
        cls,
        request: HttpRequest,
        organization_id: int,
        email: str,
        logger: Logger | None = None,
    ) -> ApiInviteHelper | None:
        """
        Initializes the ApiInviteHelper by locating the pending organization
        member via the currently set pending invite details in the session, or
        via the passed email if no cookie is currently set.
        """
        invite_details = get_invite_details(request)
        # Came from a different organization.
        if (
            invite_details.invite_organization_id is not None
            and invite_details.invite_organization_id != organization_id
        ):
            invite_details = InviteDetails(None, None, None)

        invite = None
        if invite_details.invite_token and invite_details.invite_member_id:
            invite = organization_service.get_invite_by_id(
                organization_id=organization_id,
                organization_member_id=invite_details.invite_member_id,
                user_id=request.user.id,
            )
        else:
            invite = organization_service.get_invite_by_id(
                organization_id=organization_id, email=email, user_id=request.user.id
            )
        if invite is None:
            # Unable to locate the pending organization member. Cannot setup
            # the invite helper.
            return None

        return cls(
            request=request,
            invite_context=invite,
            token=invite_details.invite_token,
            logger=logger,
        )

    @classmethod
    def from_session(
        cls,
        request: HttpRequest,
        logger: Logger | None = None,
    ) -> ApiInviteHelper | None:
        invite_details = get_invite_details(request)

        if not invite_details.invite_token or not invite_details.invite_member_id:
            return None

        invite_context = organization_service.get_invite_by_id(
            organization_member_id=invite_details.invite_member_id,
            organization_id=invite_details.invite_organization_id,
            user_id=request.user.id,
        )
        if invite_context is None:
            if logger:
                logger.exception("Invalid pending invite cookie")
            return None

        api_invite_helper = ApiInviteHelper(
            request=request,
            invite_context=invite_context,
            token=invite_details.invite_token,
            logger=logger,
        )

        return api_invite_helper

    def __init__(
        self,
        request: HttpRequest,
        invite_context: RpcUserInviteContext,
        token: str | None,
        logger: Logger | None = None,
    ) -> None:
        self.request = request
        self.token = token
        self.logger = logger
        self.invite_context = invite_context

    def handle_member_already_exists(self) -> None:
        if self.logger:
            self.logger.info(
                "Pending org invite not accepted - User already org member",
                extra={
                    "organization_id": self.invite_context.organization.id,
                    "user_id": self.request.user.id,
                },
            )

    def handle_member_has_no_sso(self) -> None:
        if self.logger:
            self.logger.info(
                "Pending org invite not accepted - User did not have SSO",
                extra={
                    "organization_id": self.invite_context.organization.id,
                    "user_id": self.request.user.id,
                },
            )

    def handle_invite_not_approved(self) -> None:
        if not self.invite_approved:
            assert self.invite_context.member
            organization_service.delete_organization_member(
                organization_member_id=self.invite_context.member.id,
                organization_id=self.invite_context.organization.id,
            )

    @property
    def member_pending(self) -> bool:
        assert self.invite_context.member
        return self.invite_context.member.is_pending

    @property
    def invite_approved(self) -> bool:
        assert self.invite_context.member
        return self.invite_context.member.invite_approved

    @property
    def valid_token(self) -> bool:
        if self.token is None:
            return False
        assert self.invite_context.member
        if self.invite_context.member.token_expired:
            return False
        tokens_are_equal = constant_time_compare(
            self.invite_context.member.token or self.invite_context.member.legacy_token,
            self.token,
        )
        return tokens_are_equal

    @property
    def user_authenticated(self) -> bool:
        return self.request.user.is_authenticated

    @property
    def member_already_exists(self) -> bool:
        if not self.user_authenticated:
            return False
        return self.invite_context.user_id is not None

    @property
    def valid_request(self) -> bool:
        return (
            self.member_pending
            and self.invite_approved
            and self.valid_token
            and self.user_authenticated
            and not any(self.get_onboarding_steps().values())
        )

    def accept_invite(self, user: User | None = None) -> RpcOrganizationMember | None:
        member = self.invite_context.member
        assert member

        if user is None:
            user = self.request.user

        if self.member_already_exists:
            self.handle_member_already_exists()
            organization_service.delete_organization_member(
                organization_member_id=self.invite_context.invite_organization_member_id,
                organization_id=self.invite_context.organization.id,
            )
            return None

        try:
            provider = AuthProvider.objects.get(organization_id=self.invite_context.organization.id)
        except AuthProvider.DoesNotExist:
            provider = None

        # If SSO is required, check for valid AuthIdentity
        if provider and not provider.flags.allow_unlinked:
            # AuthIdentity has a unique constraint on provider and user
            if not AuthIdentity.objects.filter(auth_provider=provider, user=user).exists():
                self.handle_member_has_no_sso()
                return None

        new_om = organization_service.set_user_for_organization_member(
            organization_member_id=member.id,
            user_id=user.id,
            organization_id=self.invite_context.organization.id,
        )
        if new_om:
            self.invite_context.member = member = new_om

        create_audit_entry(
            self.request,
            actor=user,
            organization_id=self.invite_context.organization.id,
            target_object=member.id,
            target_user_id=user.id,
            event=audit_log.get_event_id("MEMBER_ACCEPT"),
            data=member.get_audit_log_metadata(),
        )

        metrics.incr("organization.invite-accepted", sample_rate=1.0)
        organization_service.schedule_signal(
            member_joined,
            organization_id=member.organization_id,
            args=dict(
                user_id=member.user_id,
                organization_member_id=member.id,
            ),
        )

        return member

    def _needs_2fa(self) -> bool:
        org_requires_2fa = self.invite_context.organization.flags.require_2fa
        return org_requires_2fa and (
            not self.request.user.is_authenticated or not self.request.user.has_2fa()
        )

    def _needs_email_verification(self) -> bool:
        organization = self.invite_context.organization
        if not (
            features.has("organizations:required-email-verification", organization)
            and organization.flags.require_email_verification
        ):
            return False

        user = self.request.user
        primary_email_is_verified = (
            isinstance(user, User) and UserEmail.objects.get_primary_email(user).is_verified
        )
        return not primary_email_is_verified

    def get_onboarding_steps(self) -> Dict[str, bool]:
        return {
            "needs2fa": self._needs_2fa(),
            "needsEmailVerification": self._needs_email_verification(),
        }
