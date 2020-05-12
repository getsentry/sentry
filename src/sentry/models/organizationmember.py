from __future__ import absolute_import, print_function

import six

from bitfield import BitField
from datetime import timedelta
from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import models, transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.translation import ugettext_lazy as _
from enum import Enum
from hashlib import md5
from structlog import get_logger
from uuid import uuid4
from six.moves.urllib.parse import urlencode

from sentry import roles
from sentry.constants import EVENTS_MEMBER_ADMIN_DEFAULT
from sentry.db.models import (
    BaseModel,
    BoundedAutoField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)
from sentry.models.team import TeamStatus
from sentry.utils.http import absolute_uri

INVITE_DAYS_VALID = 30


class InviteStatus(Enum):
    APPROVED = 0
    REQUESTED_TO_BE_INVITED = 1
    REQUESTED_TO_JOIN = 2


invite_status_names = {
    InviteStatus.APPROVED.value: "approved",
    InviteStatus.REQUESTED_TO_BE_INVITED.value: "requested_to_be_invited",
    InviteStatus.REQUESTED_TO_JOIN.value: "requested_to_join",
}


class OrganizationMemberTeam(BaseModel):
    """
    Identifies relationships between organization members and the teams they are on.
    """

    __core__ = True

    id = BoundedAutoField(primary_key=True)
    team = FlexibleForeignKey("sentry.Team")
    organizationmember = FlexibleForeignKey("sentry.OrganizationMember")
    # an inactive membership simply removes the team from the default list
    # but still allows them to re-join without request
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmember_teams"
        unique_together = (("team", "organizationmember"),)

    __repr__ = sane_repr("team_id", "organizationmember_id")

    def get_audit_log_data(self):
        return {
            "team_slug": self.team.slug,
            "member_id": self.organizationmember_id,
            "email": self.organizationmember.get_email(),
            "is_active": self.is_active,
        }


class OrganizationMember(Model):
    """
    Identifies relationships between organizations and users.

    Users listed as team members are considered to have access to all projects
    and could be thought of as team owners (though their access level may not)
    be set to ownership.
    """

    __core__ = True

    organization = FlexibleForeignKey("sentry.Organization", related_name="member_set")

    user = FlexibleForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="sentry_orgmember_set"
    )
    email = models.EmailField(null=True, blank=True, max_length=75)
    role = models.CharField(max_length=32, default=roles.get_default().id)
    flags = BitField(
        flags=(("sso:linked", "sso:linked"), ("sso:invalid", "sso:invalid")), default=0
    )
    token = models.CharField(max_length=64, null=True, blank=True, unique=True)
    date_added = models.DateTimeField(default=timezone.now)
    token_expires_at = models.DateTimeField(default=None, null=True)
    has_global_access = models.BooleanField(default=True)
    teams = models.ManyToManyField(
        "sentry.Team", blank=True, through="sentry.OrganizationMemberTeam"
    )
    inviter = FlexibleForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="sentry_inviter_set"
    )
    invite_status = models.PositiveSmallIntegerField(
        choices=(
            (InviteStatus.APPROVED.value, _("Approved")),
            (
                InviteStatus.REQUESTED_TO_BE_INVITED.value,
                _("Organization member requested to invite user"),
            ),
            (InviteStatus.REQUESTED_TO_JOIN.value, _("User requested to join organization")),
        ),
        default=InviteStatus.APPROVED.value,
        null=True,
    )

    # Deprecated -- no longer used
    type = BoundedPositiveIntegerField(default=50, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmember"
        unique_together = (("organization", "user"), ("organization", "email"))

    __repr__ = sane_repr("organization_id", "user_id", "role")

    @transaction.atomic
    def save(self, *args, **kwargs):
        assert self.user_id or self.email, "Must set user or email"
        if self.token and not self.token_expires_at:
            self.refresh_expires_at()
        super(OrganizationMember, self).save(*args, **kwargs)

    def set_user(self, user):
        self.user = user
        self.email = None
        self.token = None
        self.token_expires_at = None

    def remove_user(self):
        self.email = self.get_email()
        self.user = None
        self.token = self.generate_token()

    def regenerate_token(self):
        self.token = self.generate_token()
        self.refresh_expires_at()

    def refresh_expires_at(self):
        now = timezone.now()
        self.token_expires_at = now + timedelta(days=INVITE_DAYS_VALID)

    def approve_invite(self):
        self.invite_status = InviteStatus.APPROVED.value
        self.regenerate_token()

    def get_invite_status_name(self):
        if self.invite_status is None:
            return
        return invite_status_names[self.invite_status]

    @property
    def invite_approved(self):
        return self.invite_status == InviteStatus.APPROVED.value

    @property
    def requested_to_join(self):
        return self.invite_status == InviteStatus.REQUESTED_TO_JOIN.value

    @property
    def requested_to_be_invited(self):
        return self.invite_status == InviteStatus.REQUESTED_TO_BE_INVITED.value

    @property
    def is_pending(self):
        return self.user_id is None

    @property
    def token_expired(self):
        # Old tokens don't expire to preserve compatibility and not require
        # a backfill migration.
        if self.token_expires_at is None:
            return False
        if self.token_expires_at > timezone.now():
            return False
        return True

    @property
    def legacy_token(self):
        checksum = md5()
        checksum.update(six.text_type(self.organization_id).encode("utf-8"))
        checksum.update(self.get_email().encode("utf-8"))
        checksum.update(force_bytes(settings.SECRET_KEY))
        return checksum.hexdigest()

    def generate_token(self):
        return uuid4().hex + uuid4().hex

    def get_invite_link(self):
        if not self.is_pending or not self.invite_approved:
            return None
        return absolute_uri(
            reverse(
                "sentry-accept-invite",
                kwargs={"member_id": self.id, "token": self.token or self.legacy_token},
            )
        )

    def send_invite_email(self):
        from sentry.utils.email import MessageBuilder

        context = {
            "email": self.email,
            "organization": self.organization,
            "url": self.get_invite_link(),
        }

        msg = MessageBuilder(
            subject="Join %s in using Sentry" % self.organization.name,
            template="sentry/emails/member-invite.txt",
            html_template="sentry/emails/member-invite.html",
            type="organization.invite",
            context=context,
        )

        try:
            msg.send_async([self.get_email()])
        except Exception as e:
            logger = get_logger(name="sentry.mail")
            logger.exception(e)

    def send_sso_link_email(self, actor, provider):
        from sentry.utils.email import MessageBuilder

        link_args = {"organization_slug": self.organization.slug}

        context = {
            "organization": self.organization,
            "actor": actor,
            "provider": provider,
            "url": absolute_uri(reverse("sentry-auth-organization", kwargs=link_args)),
        }

        msg = MessageBuilder(
            subject="Action Required for %s" % (self.organization.name,),
            template="sentry/emails/auth-link-identity.txt",
            html_template="sentry/emails/auth-link-identity.html",
            type="organization.auth_link",
            context=context,
        )
        msg.send_async([self.get_email()])

    def send_sso_unlink_email(self, actor, provider):
        from sentry.utils.email import MessageBuilder
        from sentry.models import LostPasswordHash

        email = self.get_email()

        recover_uri = u"{path}?{query}".format(
            path=reverse("sentry-account-recover"), query=urlencode({"email": email})
        )

        # Nothing to send if this member isn't associated to a user
        if not self.user_id:
            return

        context = {
            "email": email,
            "recover_url": absolute_uri(recover_uri),
            "has_password": self.user.password,
            "organization": self.organization,
            "actor": actor,
            "provider": provider,
        }

        if not self.user.password:
            password_hash = LostPasswordHash.for_user(self.user)
            context["set_password_url"] = password_hash.get_absolute_url(mode="set_password")

        msg = MessageBuilder(
            subject="Action Required for %s" % (self.organization.name,),
            template="sentry/emails/auth-sso-disabled.txt",
            html_template="sentry/emails/auth-sso-disabled.html",
            type="organization.auth_sso_disabled",
            context=context,
        )
        msg.send_async([email])

    def get_display_name(self):
        if self.user_id:
            return self.user.get_display_name()
        return self.email

    def get_label(self):
        if self.user_id:
            return self.user.get_label()
        return self.email or self.id

    def get_email(self):
        if self.user_id and self.user.email:
            return self.user.email
        return self.email

    def get_avatar_type(self):
        if self.user_id:
            return self.user.get_avatar_type()
        return "letter_avatar"

    def get_audit_log_data(self):
        from sentry.models import Team

        teams = list(
            Team.objects.filter(
                id__in=OrganizationMemberTeam.objects.filter(
                    organizationmember=self, is_active=True
                ).values_list("team", flat=True)
            ).values("id", "slug")
        )

        return {
            "email": self.get_email(),
            "user": self.user_id,
            "teams": [t["id"] for t in teams],
            "teams_slugs": [t["slug"] for t in teams],
            "has_global_access": self.has_global_access,
            "role": self.role,
            "invite_status": invite_status_names[self.invite_status],
        }

    def get_teams(self):
        from sentry.models import Team

        return Team.objects.filter(
            status=TeamStatus.VISIBLE,
            id__in=OrganizationMemberTeam.objects.filter(
                organizationmember=self, is_active=True
            ).values("team"),
        )

    def get_scopes(self):
        scopes = roles.get(self.role).scopes

        if self.role == "member" and not self.organization.get_option(
            "sentry:events_member_admin", EVENTS_MEMBER_ADMIN_DEFAULT
        ):
            scopes = frozenset(s for s in scopes if s != "event:admin")

        return scopes

    @classmethod
    def delete_expired(cls, threshold):
        """
        Delete un-accepted member invitations that expired
        ``threshold`` days ago.
        """
        cls.objects.filter(token_expires_at__lt=threshold, user_id__exact=None).exclude(
            email__exact=None
        ).delete()
