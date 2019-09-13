from __future__ import absolute_import

from six.moves.urllib.parse import urlencode, parse_qsl
from django.utils.crypto import constant_time_compare
from django.core.urlresolvers import reverse

from sentry.utils import metrics
from sentry.models import AuditLogEntryEvent, Authenticator, OrganizationMember
from sentry.signals import member_joined

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


class ApiInviteHelper(object):
    def __init__(self, instance, request, member_id, token, logger=None):
        self.request = request
        self.instance = instance
        self.member_id = member_id
        self.token = token
        self.logger = logger
        self.om = self.organization_member

    def handle_success(self):
        member_joined.send_robust(
            member=self.om, organization=self.om.organization, sender=self.instance
        )

    def handle_member_already_exists(self):
        if self.logger:
            self.logger.info(
                "Pending org invite not accepted - User already org member",
                extra={"organization_id": self.om.organization.id, "user_id": self.request.user.id},
            )

    @property
    def organization_member(self):
        return OrganizationMember.objects.select_related("organization").get(pk=self.member_id)

    @property
    def member_pending(self):
        return self.om.is_pending

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
        else:
            om.set_user(user)
            om.save()

            self.instance.create_audit_entry(
                self.request,
                organization=om.organization,
                target_object=om.id,
                target_user=user,
                event=AuditLogEntryEvent.MEMBER_ACCEPT,
                data=om.get_audit_log_data(),
            )

            self.handle_success()
            metrics.incr("organization.invite-accepted", sample_rate=1.0)
