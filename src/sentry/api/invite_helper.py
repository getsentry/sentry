from __future__ import annotations

from logging import Logger
from typing import Any, Dict, Tuple

from django.utils.crypto import constant_time_compare
from rest_framework.request import Request

from sentry import audit_log, features
from sentry.models import AuthIdentity, AuthProvider, User, UserEmail
from sentry.services.hybrid_cloud.organization import RpcOrganizationMember, organization_service
from sentry.signals import member_joined
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry


def add_invite_details_to_session(request: Request, member_id: int, token: str) -> None:
    """Add member ID and token to the request session"""
    request.session["invite_token"] = token
    request.session["invite_member_id"] = member_id


def remove_invite_details_from_session(request: Request) -> None:
    """Deletes invite details from the request session"""
    request.session.pop("invite_member_id", None)
    request.session.pop("invite_token", None)


def get_invite_details(request: Request) -> Tuple[str, int]:
    """Returns tuple of (token, member_id) from request session"""
    return request.session.get("invite_token", None), request.session.get("invite_member_id", None)


class ApiInviteHelper:
    @classmethod
    def from_session_or_email(
        cls,
        request: Request,
        organization_id: int,
        email: str,
        instance: Any | None = None,
        logger: Logger | None = None,
    ) -> ApiInviteHelper | None:
        """
        Initializes the ApiInviteHelper by locating the pending organization
        member via the currently set pending invite details in the session, or
        via the passed email if no cookie is currently set.
        """
        invite_token, invite_member_id = get_invite_details(request)

        om = None
        if invite_token and invite_member_id:
            om = organization_service.check_membership_by_invite_token(
                organization_id=organization_id,
                org_member_id=invite_member_id,
                invite_token=invite_token,
            )
        else:
            om = organization_service.check_membership_by_email(
                organization_id=organization_id, email=email
            )
        if om is None:
            # Unable to locate the pending organization member. Cannot setup
            # the invite helper.
            return None

        return cls(
            request=request, member_id=om.id, token=om.token, instance=instance, logger=logger
        )

    @classmethod
    def from_session(
        cls,
        request: Request,
        instance: Any | None = None,
        logger: Logger | None = None,
    ) -> ApiInviteHelper | None:
        invite_token, invite_member_id = get_invite_details(request)

        if not invite_token or not invite_member_id:
            return None

        api_invite_helper = ApiInviteHelper(
            request=request,
            member_id=invite_member_id,
            token=invite_token,
            instance=instance,
            logger=logger,
        )

        if api_invite_helper.om is None:
            if logger:
                logger.error("Invalid pending invite cookie", exc_info=True)
            return None
        return api_invite_helper

    def __init__(
        self,
        request: Request,
        member_id: int,
        token: str | None,
        instance: Any | None = None,
        logger: Logger | None = None,
    ) -> None:
        self.request = request
        self.member_id = member_id
        self.token = token
        self.instance = instance
        self.logger = logger
        self.om = organization_service.get_organization_member(organization_member_id=member_id)
        self.organization_id = self.om.organization_id if self.om else None

    def handle_success(self) -> None:
        member_joined.send_robust(
            member=self.om,
            organization_id=self.organization_id,
            sender=self.instance if self.instance else self,
        )

    def handle_member_already_exists(self) -> None:
        if self.logger:
            self.logger.info(
                "Pending org invite not accepted - User already org member",
                extra={"organization_id": self.organization_id, "user_id": self.request.user.id},
            )

    def handle_member_has_no_sso(self) -> None:
        if self.logger:
            self.logger.info(
                "Pending org invite not accepted - User did not have SSO",
                extra={"organization_id": self.organization_id, "user_id": self.request.user.id},
            )

    def handle_invite_not_approved(self) -> None:
        if not self.invite_approved:
            assert self.om
            organization_service.delete_organization_member(organization_member_id=self.om.id)

    @property
    def member_pending(self) -> bool:
        assert self.om
        return self.om.is_pending

    @property
    def invite_approved(self) -> bool:
        assert self.om
        return self.om.invite_approved

    @property
    def valid_token(self) -> bool:
        if self.token is None:
            return False
        assert self.om
        if self.om.token_expired:
            return False
        tokens_are_equal = constant_time_compare(self.om.token or self.om.legacy_token, self.token)
        return tokens_are_equal

    @property
    def user_authenticated(self) -> bool:
        return self.request.user.is_authenticated  # type: ignore[no-any-return]

    @property
    def member_already_exists(self) -> bool:
        if not self.user_authenticated:
            return False
        rpc_org_member = organization_service.check_membership_by_id(
            organization_id=self.organization_id, user_id=self.request.user.id
        )
        return rpc_org_member is not None

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
        assert self.om
        om = self.om

        if user is None:
            user = self.request.user

        if self.member_already_exists:
            self.handle_member_already_exists()
            organization_service.delete_organization_member(organization_member_id=self.om.id)
            return None

        try:
            provider = AuthProvider.objects.get(organization_id=om.organization_id)
        except AuthProvider.DoesNotExist:
            provider = None

        # If SSO is required, check for valid AuthIdentity
        if provider and not provider.flags.allow_unlinked:
            # AuthIdentity has a unique constraint on provider and user
            if not AuthIdentity.objects.filter(auth_provider=provider, user=user).exists():
                self.handle_member_has_no_sso()
                return None

        self.om = om = organization_service.set_user_for_organization_member(
            organization_member_id=self.om.id, user_id=user.id
        )

        create_audit_entry(
            self.request,
            actor=user,
            organization_id=self.organization_id,
            target_object=om.id,
            target_user=user,
            event=audit_log.get_event_id("MEMBER_ACCEPT"),
            data=om.get_audit_log_metadata(),
        )

        self.handle_success()
        metrics.incr("organization.invite-accepted", sample_rate=1.0)

        return om

    def _needs_2fa(self) -> bool:
        rpc_user_org = organization_service.get_organization_by_id(id=self.organization_id)
        assert rpc_user_org
        org_requires_2fa = rpc_user_org.organization.flags.require_2fa
        return org_requires_2fa and (
            not self.request.user.is_authenticated or not self.request.user.has_2fa()
        )

    def _needs_email_verification(self) -> bool:
        rpc_user_org = organization_service.get_organization_by_id(id=self.organization_id)
        assert rpc_user_org
        organization = rpc_user_org.organization
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
