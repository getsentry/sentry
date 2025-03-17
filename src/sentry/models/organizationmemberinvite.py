import secrets
from datetime import timedelta
from enum import Enum

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.roles import organization_roles

INVITE_DAYS_VALID = 30


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


def default_expiration():
    return timezone.now() + timedelta(days=INVITE_DAYS_VALID)


def generate_token():
    return secrets.token_hex(nbytes=32)


@region_silo_model
class OrganizationMemberInvite(DefaultFieldsModel):
    """
    Identifies relationships between organizations and their invited users.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization", related_name="invite_set")
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
    organization_member_team_data = models.JSONField(default=dict)
    token = models.CharField(max_length=64, unique=True, default=generate_token)
    token_expires_at = models.DateTimeField(default=default_expiration)

    # the subsequent fields correspond to _OrganizationMemberFlags
    sso_linked = models.BooleanField(default=False)
    sso_invalid = models.BooleanField(default=False)
    member_limit_restricted = models.BooleanField(default=False)
    idp_provisioned = models.BooleanField(default=False)
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

    @property
    def invite_approved(self):
        return self.invite_status == InviteStatus.APPROVED.value

    @property
    def requested_to_join(self):
        return self.invite_status == InviteStatus.REQUESTED_TO_JOIN.value

    @property
    def requested_to_be_invited(self):
        return self.invite_status == InviteStatus.REQUESTED_TO_BE_INVITED.value

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
