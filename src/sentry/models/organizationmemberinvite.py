from datetime import timedelta, timezone
from enum import Enum

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from structlog import get_logger

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.hybridcloud.outbox.base import ReplicatedRegionModel
from sentry.hybridcloud.outbox.category import OutboxCategory
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


@region_silo_model
class OrganizationMemberInvite(ReplicatedRegionModel):
    """
    Identifies relationships between organizations and their invited users.
    """

    __relocation_scope__ = RelocationScope.Organization
    category = OutboxCategory.ORGANIZATION_MEMBER_INVITE

    organization = FlexibleForeignKey("sentry.Organization")
    inviter_id = HybridCloudForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete="SET_NULL",
    )
    invite_status = models.PositiveSmallIntegerField(
        choices=InviteStatus.as_choices(),
        default=InviteStatus.APPROVED.value,
        null=True,
    )
    email = models.EmailField(null=True, blank=True, max_length=75)
    role = models.CharField(max_length=32, default=str(organization_roles.get_default().id))
    organization_member_team_data = models.JSONField(default=dict)
    token = models.CharField(max_length=64, null=True, blank=True, unique=True)
    token_expires_at = models.DateTimeField(default=None, null=True)

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
        if not self.is_pending or not self.invite_approved:
            return None
        path = reverse(
            "sentry-accept-invite",
            kwargs={
                "member_id": self.id,
                "token": self.token or self.legacy_token,
            },
        )
        invite_link = self.organization.absolute_url(path)
        if referrer:
            invite_link += "?referrer=" + referrer
        return invite_link

    def send_invite_email(self, referrer: str | None = None):
        from sentry.utils.email import MessageBuilder

        context = {
            "email": self.email,
            "organization": self.organization,
            "url": self.get_invite_link(referrer),
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
            mail_logger = get_logger(name="sentry.mail")
            mail_logger.exception(e)

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
