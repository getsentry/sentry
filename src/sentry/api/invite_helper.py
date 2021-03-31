from urllib.parse import parse_qsl, urlencode

from django.core.urlresolvers import reverse
from django.utils.crypto import constant_time_compare

from sentry.models import (
    AuditLogEntryEvent,
    Authenticator,
    AuthIdentity,
    AuthProvider,
    OrganizationMember,
)
from sentry.signals import member_joined
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry

INVITE_COOKIE = "pending-invite"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def add_invite_cookie(request, response, member_id, token):
    url = reverse("sentry-accept-invite", args=[member_id, token])
    response.set_cookie(
        INVITE_COOKIE,
        urlencode({"memberId": member_id, "token": token, "url": url}),
        max_age=COOKIE_MAX_AGE,
    )


def remove_invite_cookie(request, response):
    if INVITE_COOKIE in request.COOKIES:
        response.delete_cookie(INVITE_COOKIE)


def get_invite_cookie(request):
    if INVITE_COOKIE not in request.COOKIES:
        return None

    # memberId should be coerced back to an integer
    invite_data = dict(parse_qsl(request.COOKIES.get(INVITE_COOKIE)))
    invite_data["memberId"] = int(invite_data["memberId"])

    return invite_data


class ApiInviteHelper:
    @classmethod
    def from_cookie_or_email(cls, request, organization, email, instance=None, logger=None):
        """
        Initializes the ApiInviteHelper by locating the pending organization
        member via the currently set pending invite cookie, or via the passed
        email if no cookie is currently set.
        """
        pending_invite = get_invite_cookie(request)

        try:
            if pending_invite is not None:
                om = OrganizationMember.objects.get(
                    id=pending_invite["memberId"], token=pending_invite["token"]
                )
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
    def from_cookie(cls, request, instance=None, logger=None):
        org_invite = get_invite_cookie(request)

        if not org_invite:
            return None

        try:
            return ApiInviteHelper(
                request=request,
                member_id=org_invite["memberId"],
                token=org_invite["token"],
                instance=instance,
                logger=logger,
            )
        except OrganizationMember.DoesNotExist:
            if logger:
                logger.error("Invalid pending invite cookie", exc_info=True)
            return None

    def __init__(self, request, member_id, token, instance=None, logger=None):
        self.request = request
        self.member_id = member_id
        self.token = token
        self.instance = instance
        self.logger = logger
        self.om = self.organization_member

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
    def organization_member(self):
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
        return self.request.user.is_authenticated()

    @property
    def needs_2fa(self):
        org_requires_2fa = self.om.organization.flags.require_2fa.is_set
        user_has_2fa = Authenticator.objects.user_has_2fa(self.request.user.id)
        return org_requires_2fa and not user_has_2fa

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
            and not self.needs_2fa
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
            event=AuditLogEntryEvent.MEMBER_ACCEPT,
            data=om.get_audit_log_data(),
        )

        self.handle_success()
        metrics.incr("organization.invite-accepted", sample_rate=1.0)
