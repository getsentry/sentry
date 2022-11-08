from typing import Dict, Tuple

from django.utils.crypto import constant_time_compare
from rest_framework.request import Request

from sentry import audit_log, features
from sentry.models import (
    Authenticator,
    AuthIdentity,
    AuthProvider,
    OrganizationMember,
    User,
    UserEmail,
)
from sentry.signals import member_joined
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry


def add_invite_details_to_session(request: Request, member_id: int, token: str):
    """Add member ID and token to the request session"""
    request.session["invite_token"] = token
    request.session["invite_member_id"] = member_id


def remove_invite_details_from_session(request):
    """Deletes invite details from the request session"""
    request.session.pop("invite_member_id", None)
    request.session.pop("invite_token", None)


def get_invite_details(request) -> Tuple[str, int]:
    """Returns tuple of (token, member_id) from request session"""
    return request.session.get("invite_token", None), request.session.get("invite_member_id", None)


class ApiInviteHelper:
    @classmethod
    def from_session_or_email(cls, request, organization, email, instance=None, logger=None):
        """
        Initializes the ApiInviteHelper by locating the pending organization
        member via the currently set pending invite details in the session, or
        via the passed email if no cookie is currently set.
        """
        invite_token, invite_member_id = get_invite_details(request)

        try:
            if invite_token is not None and invite_member_id is not None:
                om = OrganizationMember.objects.get(token=invite_token, id=invite_member_id)
            else:
                om = OrganizationMember.objects.get(
                    email=email, organization=organization, user=None
                )
        except OrganizationMember.DoesNotExist:
            # Unable to locate the pending organization member. Cannot setup
            # the invite helper.
            return None

        return cls(
            request=request, member_id=om.id, token=om.token, instance=instance, logger=logger
        )

    @classmethod
    def from_session(cls, request, instance=None, logger=None):
        invite_token, invite_member_id = get_invite_details(request)

        if not invite_token and not invite_member_id:
            return None

        try:
            return ApiInviteHelper(
                request=request,
                member_id=invite_member_id,
                token=invite_token,
                instance=instance,
                logger=logger,
            )
        except OrganizationMember.DoesNotExist:
            if logger:
                logger.error("Invalid pending invite cookie", exc_info=True)
            return None

    def __init__(self, request, member_id, token, instance=None, logger=None):
        self.request: Request = request
        self.member_id: int = member_id
        self.token: str = token
        self.instance = instance
        self.logger = logger
        self.om: OrganizationMember = self.organization_member

    def handle_success(self):
        member_joined.send_robust(
            member=self.om,
            organization=self.om.organization,
            sender=self.instance if self.instance else self,
        )

    def handle_member_already_exists(self):
        if self.logger:
            self.logger.info(
                "Pending org invite not accepted - User already org member",
                extra={"organization_id": self.om.organization.id, "user_id": self.request.user.id},
            )

    def handle_member_has_no_sso(self):
        if self.logger:
            self.logger.info(
                "Pending org invite not accepted - User did not have SSO",
                extra={"organization_id": self.om.organization.id, "user_id": self.request.user.id},
            )

    def handle_invite_not_approved(self):
        if not self.invite_approved:
            self.om.delete()

    @property
    def organization_member(self) -> OrganizationMember:
        return OrganizationMember.objects.select_related("organization").get(pk=self.member_id)

    @property
    def member_pending(self):
        return self.om.is_pending

    @property
    def invite_approved(self):
        return self.om.invite_approved

    @property
    def valid_token(self):
        if self.token is None:
            return False
        if self.om.token_expired:
            return False
        return constant_time_compare(self.om.token or self.om.legacy_token, self.token)

    @property
    def user_authenticated(self):
        return self.request.user.is_authenticated

    @property
    def member_already_exists(self):
        if not self.user_authenticated:
            return False

        return OrganizationMember.objects.filter(
            organization=self.om.organization, user=self.request.user
        ).exists()

    @property
    def valid_request(self):
        return (
            self.member_pending
            and self.invite_approved
            and self.valid_token
            and self.user_authenticated
            and not any(self.get_onboarding_steps().values())
        )

    def accept_invite(self, user=None):
        om = self.om

        if user is None:
            user = self.request.user

        if self.member_already_exists:
            self.handle_member_already_exists()
            om.delete()
            return

        try:
            provider = AuthProvider.objects.get(organization=om.organization)
        except AuthProvider.DoesNotExist:
            provider = None

        # If SSO is required, check for valid AuthIdentity
        if provider and not provider.flags.allow_unlinked:
            # AuthIdentity has a unique constraint on provider and user
            if not AuthIdentity.objects.filter(auth_provider=provider, user=user).exists():
                self.handle_member_has_no_sso()
                return

        om.set_user(user)
        om.save()

        create_audit_entry(
            self.request,
            actor=user,
            organization=om.organization,
            target_object=om.id,
            target_user=user,
            event=audit_log.get_event_id("MEMBER_ACCEPT"),
            data=om.get_audit_log_data(),
        )

        self.handle_success()
        metrics.incr("organization.invite-accepted", sample_rate=1.0)

        return om

    def _needs_2fa(self) -> bool:
        org_requires_2fa = self.om.organization.flags.require_2fa.is_set
        user_has_2fa = Authenticator.objects.user_has_2fa(self.request.user.id)
        return org_requires_2fa and not user_has_2fa

    def _needs_email_verification(self) -> bool:
        organization = self.om.organization
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
