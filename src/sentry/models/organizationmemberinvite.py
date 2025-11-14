import secrets
from datetime import datetime, timedelta
from enum import Enum
from typing import int, TypedDict

from django.conf import settings
from django.db import models, router, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry import features
from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.exceptions import UnableToAcceptMemberInvitationException
from sentry.models.team import Team
from sentry.roles import organization_roles
from sentry.signals import member_invited

INVITE_DAYS_VALID = 30

__all__ = ("OrganizationMemberInvite",)


class InviteStatus(Enum):
    APPROVED = 0
    REQUESTED_TO_BE_INVITED = 1
    REQUESTED_TO_JOIN = 2

    @classmethod
    def as_choices(cls):
        return (
            (InviteStatus.APPROVED.value, _("Approved")),
            (
                InviteStatus.REQUESTED_TO_BE_INVITED.value,
                _("Organization member requested to invite user"),
            ),
            (InviteStatus.REQUESTED_TO_JOIN.value, _("User requested to join organization")),
        )


invite_status_names = {
    InviteStatus.APPROVED.value: "approved",
    InviteStatus.REQUESTED_TO_BE_INVITED.value: "requested_to_be_invited",
    InviteStatus.REQUESTED_TO_JOIN.value: "requested_to_join",
}

ERR_CANNOT_INVITE = "Your organization is not allowed to invite members."
ERR_JOIN_REQUESTS_DISABLED = "Your organization does not allow requests to join."


def default_expiration():
    return timezone.now() + timedelta(days=INVITE_DAYS_VALID)


def generate_token():
    return secrets.token_hex(nbytes=32)


class OrganizationMemberInviteResponse(TypedDict):
    id: str
    email: str
    orgRole: str
    expired: bool
    idpProvisioned: bool
    idpRoleRestricted: bool
    ssoLinked: bool
    ssoInvalid: bool
    memberLimitRestricted: bool
    partnershipRestricted: bool
    dateCreated: datetime
    inviteStatus: str
    inviterName: str | None
    teams: list[dict]


@region_silo_model
class OrganizationMemberInvite(DefaultFieldsModel):
    """
    Identifies relationships between organizations and their invited users.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization", related_name="invite_set")
    # SCIM provisioning requires that the OrganizationMember object exist. Until the user
    # accepts their invite, the OrganizationMember is a placeholder and will not be surfaced via API.
    organization_member = FlexibleForeignKey("sentry.OrganizationMember")
    inviter_id = HybridCloudForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete="SET_NULL",
    )
    invite_status = models.PositiveSmallIntegerField(
        choices=InviteStatus.as_choices(),
        default=InviteStatus.APPROVED.value,
    )
    email = models.EmailField(max_length=75)
    role = models.CharField(max_length=32, default=str(organization_roles.get_default().id))
    organization_member_team_data = models.JSONField(default=list)
    token = models.CharField(max_length=64, unique=True, default=generate_token)
    token_expires_at = models.DateTimeField(default=default_expiration)

    # the subsequent fields correspond to _OrganizationMemberFlags
    sso_linked = models.BooleanField(default=False)
    sso_invalid = models.BooleanField(default=False)
    member_limit_restricted = models.BooleanField(default=False)
    idp_provisioned = models.BooleanField(default=False, db_default=False)
    idp_role_restricted = models.BooleanField(default=False)
    partnership_restricted = models.BooleanField(default=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmemberinvite"
        unique_together = ("organization", "email")

    __repr__ = sane_repr("organization_id", "email", "role")

    def get_invite_link(self, referrer: str | None = None):
        pass

    def send_invite_email(self, referrer: str | None = None):
        pass

    def generate_token(self):
        return secrets.token_hex(nbytes=32)

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
        return invite_status_names[self.invite_status]

    def set_org_role(self, orgRole: str):
        self.role = orgRole
        self.save()

    def set_teams(self, teams: list[Team]):
        team_data = []
        for team in teams:
            team_data.append({"id": team.id, "slug": team.slug, "role": None})
        self.organization_member_team_data = team_data
        self.save()

    def validate_invitation(self, allowed_roles):
        """
        Validates whether an org has the options to invite members, handle join requests,
        and that the member role doesn't exceed the allowed roles to invite.
        """
        organization = self.organization
        if not features.has("organizations:invite-members", organization):
            raise UnableToAcceptMemberInvitationException(ERR_CANNOT_INVITE)

        if (
            organization.get_option("sentry:join_requests") is False
            and self.invite_status == InviteStatus.REQUESTED_TO_JOIN.value
        ):
            raise UnableToAcceptMemberInvitationException(ERR_JOIN_REQUESTS_DISABLED)

        # members cannot invite roles higher than their own
        if not {self.role} & {r.id for r in allowed_roles}:
            raise UnableToAcceptMemberInvitationException(
                f"You do not have permission to approve a member invitation with the role {self.role}."
            )
        return True

    def approve_invite_request(self, approving_user, api_key=None, ip_address=None, referrer=None):
        """
        Approve a member invite/join request and send an audit log entry
        """
        from sentry import audit_log
        from sentry.utils.audit import create_audit_entry_from_user

        with transaction.atomic(using=router.db_for_write(OrganizationMemberInvite)):
            self.approve_invite()
            self.save()

        self.send_invite_email(referrer)
        member_invited.send_robust(member=self, user=approving_user, sender=self, referrer=referrer)
        create_audit_entry_from_user(
            approving_user,
            api_key,
            ip_address,
            organization_id=self.organization_id,
            target_object=self.id,
            data=self.get_audit_log_data(),
            event=(audit_log.get_event_id("MEMBER_INVITE")),
        )

    def remove_invite_from_db(self, acting_user, event_name, api_key=None, ip_address=None):
        """
        Remove a member invite obejct from the DB and send an audit log entry
        """
        from sentry import audit_log
        from sentry.utils.audit import create_audit_entry_from_user

        with transaction.atomic(router.db_for_write(OrganizationMemberInvite)):
            # also deletes the invite object via cascades
            self.organization_member.delete()

            create_audit_entry_from_user(
                acting_user,
                api_key,
                ip_address,
                organization_id=self.organization_id,
                target_object=self.id,
                data=self.get_audit_log_data(),
                event=audit_log.get_event_id(event_name),
            )

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
    def token_expired(self):
        return self.token_expires_at <= timezone.now()

    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> tuple[int, ImportKind] | None:
        # If there is a token collision, generate new tokens.
        query = models.Q(token=self.token)
        existing = self.__class__.objects.filter(query).first()
        if existing:
            self.pk = existing.pk
            self.expires_at = timezone.now() + timedelta(days=INVITE_DAYS_VALID)
            self.token = generate_token()
            self.save()
            return (self.pk, ImportKind.Existing)

        return super().write_relocation_import(scope, flags)

    def get_audit_log_data(self):
        teams = self.organization_member_team_data
        return {
            "email": self.email,
            "teams": [t["id"] for t in teams],
            "teams_slugs": [t["slug"] for t in teams],
            "role": self.role,
            "invite_status": (invite_status_names[self.invite_status]),
        }
