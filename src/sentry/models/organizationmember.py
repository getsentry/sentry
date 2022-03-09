from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from enum import Enum
from hashlib import md5
from typing import TYPE_CHECKING, List, Mapping, MutableMapping
from urllib.parse import urlencode
from uuid import uuid4

from django.conf import settings
from django.db import models, transaction
from django.db.models import QuerySet
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.translation import ugettext_lazy as _
from structlog import get_logger

from bitfield import BitField
from sentry import features, roles
from sentry.constants import ALERTS_MEMBER_WRITE_DEFAULT, EVENTS_MEMBER_ADMIN_DEFAULT
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.db.models.manager import BaseManager
from sentry.exceptions import UnableToAcceptMemberInvitationException
from sentry.models.team import TeamStatus
from sentry.signals import member_invited
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Integration, Organization, User


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


ERR_CANNOT_INVITE = "Your organization is not allowed to invite members."
ERR_JOIN_REQUESTS_DISABLED = "Your organization does not allow requests to join."


class OrganizationMemberManager(BaseManager):
    def get_contactable_members_for_org(self, organization_id: int) -> QuerySet:
        """Get a list of members we can contact for an organization through email."""
        # TODO(Steve): check member-limit:restricted
        return self.select_related("user").filter(
            organization_id=organization_id,
            invite_status=InviteStatus.APPROVED.value,
            user__isnull=False,
        )

    def delete_expired(self, threshold: int) -> None:
        """Delete un-accepted member invitations that expired `threshold` days ago."""
        self.filter(
            token_expires_at__lt=threshold,
            user_id__exact=None,
        ).exclude(email__exact=None).delete()

    def get_for_integration(self, integration: Integration, actor: User) -> QuerySet:
        return self.filter(
            user=actor,
            organization__organizationintegration__integration=integration,
        ).select_related("organization")

    def get_member_invite_query(self, id: int) -> QuerySet:
        return self.filter(
            invite_status__in=[
                InviteStatus.REQUESTED_TO_BE_INVITED.value,
                InviteStatus.REQUESTED_TO_JOIN.value,
            ],
            user__isnull=True,
            id=id,
        )

    def get_teams_by_user(self, organization: Organization) -> Mapping[int, List[int]]:
        user_teams: MutableMapping[int, List[int]] = defaultdict(list)
        queryset = self.filter(organization_id=organization.id).values_list("user_id", "teams")
        for user_id, team_id in queryset:
            user_teams[user_id].append(team_id)
        return user_teams


class OrganizationMember(Model):
    """
    Identifies relationships between organizations and users.

    Users listed as team members are considered to have access to all projects
    and could be thought of as team owners (though their access level may not)
    be set to ownership.
    """

    __include_in_export__ = True

    objects = OrganizationMemberManager()

    organization = FlexibleForeignKey("sentry.Organization", related_name="member_set")

    user = FlexibleForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="sentry_orgmember_set"
    )
    email = models.EmailField(null=True, blank=True, max_length=75)
    role = models.CharField(max_length=32, default=str(roles.get_default().id))
    flags = BitField(
        flags=(
            ("sso:linked", "sso:linked"),
            ("sso:invalid", "sso:invalid"),
            ("member-limit:restricted", "member-limit:restricted"),
        ),
        default=0,
    )
    token = models.CharField(max_length=64, null=True, blank=True, unique=True)
    date_added = models.DateTimeField(default=timezone.now)
    token_expires_at = models.DateTimeField(default=None, null=True)
    has_global_access = models.BooleanField(default=True)
    teams = models.ManyToManyField(
        "sentry.Team", blank=True, through="sentry.OrganizationMemberTeam"
    )
    inviter = FlexibleForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="sentry_inviter_set",
        on_delete=models.SET_NULL,
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
        super().save(*args, **kwargs)

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
        checksum.update(str(self.organization_id).encode("utf-8"))
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
            subject=f"Action Required for {self.organization.name}",
            template="sentry/emails/auth-link-identity.txt",
            html_template="sentry/emails/auth-link-identity.html",
            type="organization.auth_link",
            context=context,
        )
        msg.send_async([self.get_email()])

    def send_sso_unlink_email(self, actor, provider):
        from sentry.models import LostPasswordHash
        from sentry.utils.email import MessageBuilder

        email = self.get_email()

        recover_uri = "{path}?{query}".format(
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
            subject=f"Action Required for {self.organization.name}",
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
        from sentry.models import OrganizationMemberTeam, Team

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
        from sentry.models import OrganizationMemberTeam, Team

        return Team.objects.filter(
            status=TeamStatus.VISIBLE,
            id__in=OrganizationMemberTeam.objects.filter(
                organizationmember=self, is_active=True
            ).values("team"),
        )

    def get_scopes(self):
        scopes = roles.get(self.role).scopes

        disabled_scopes = set()

        if self.role == "member":
            if not self.organization.get_option(
                "sentry:events_member_admin", EVENTS_MEMBER_ADMIN_DEFAULT
            ):
                disabled_scopes.add("event:admin")
            if not self.organization.get_option(
                "sentry:alerts_member_write", ALERTS_MEMBER_WRITE_DEFAULT
            ):
                disabled_scopes.add("alerts:write")

        scopes = frozenset(s for s in scopes if s not in disabled_scopes)
        return scopes

    def validate_invitation(self, user_to_approve, allowed_roles):
        """
        Validates whether an org has the options to invite members, handle join requests,
        and that the member role doesn't exceed the allowed roles to invite.
        """
        organization = self.organization
        if not features.has("organizations:invite-members", organization, actor=user_to_approve):
            raise UnableToAcceptMemberInvitationException(ERR_CANNOT_INVITE)

        if (
            organization.get_option("sentry:join_requests") is False
            and self.invite_status == InviteStatus.REQUESTED_TO_JOIN.value
        ):
            raise UnableToAcceptMemberInvitationException(ERR_JOIN_REQUESTS_DISABLED)

        # members cannot invite roles higher than their own
        if self.role not in {r.id for r in allowed_roles}:
            raise UnableToAcceptMemberInvitationException(
                f"You do not have permission approve a member invitation with the role {self.role}."
            )
        return True

    def approve_member_invitation(
        self, user_to_approve, api_key=None, ip_address=None, referrer=None
    ):
        """
        Approve a member invite/join request and send an audit log entry
        """
        from sentry.models.auditlogentry import AuditLogEntryEvent
        from sentry.utils.audit import create_audit_entry_from_user

        self.approve_invite()
        self.save()

        if settings.SENTRY_ENABLE_INVITES:
            self.send_invite_email()
            member_invited.send_robust(
                member=self,
                user=user_to_approve,
                sender=self.approve_member_invitation,
                referrer=referrer,
            )

        create_audit_entry_from_user(
            user_to_approve,
            api_key,
            ip_address,
            organization_id=self.organization_id,
            target_object=self.id,
            data=self.get_audit_log_data(),
            event=AuditLogEntryEvent.MEMBER_INVITE
            if settings.SENTRY_ENABLE_INVITES
            else AuditLogEntryEvent.MEMBER_ADD,
        )

    def reject_member_invitation(
        self,
        user_to_approve,
        api_key=None,
        ip_address=None,
    ):
        """
        Reject a member invite/jin request and send an audit log entry
        """
        from sentry.models.auditlogentry import AuditLogEntryEvent
        from sentry.utils.audit import create_audit_entry_from_user

        self.delete()

        create_audit_entry_from_user(
            user_to_approve,
            api_key,
            ip_address,
            organization_id=self.organization_id,
            target_object=self.id,
            data=self.get_audit_log_data(),
            event=AuditLogEntryEvent.INVITE_REQUEST_REMOVE,
        )

    def get_allowed_roles_to_invite(self):
        """
        Return a list of roles which that member could invite
        Must check if member member has member:admin first before checking
        """
        return [r for r in roles.get_all() if r.priority <= roles.get(self.role).priority]
