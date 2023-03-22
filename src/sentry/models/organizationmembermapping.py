from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.db.models.base import control_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.organizationmember import InviteStatus
from sentry.roles import organization_roles


@control_silo_only_model
class OrganizationMemberMapping(Model):
    """
    This model resides exclusively in the control silo, and will
    - map a user or an email to a specific organization to indicate an organization membership
    """

    __include_in_export__ = True

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")
    date_added = models.DateTimeField(default=timezone.now)

    role = models.CharField(max_length=32, default=str(organization_roles.get_default().id))
    user = FlexibleForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="orgmembermapping_set"
    )
    email = models.EmailField(null=True, blank=True, max_length=75)
    inviter = FlexibleForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="inviter_orgmembermapping_set",
        on_delete=models.SET_NULL,
    )
    invite_status = models.PositiveSmallIntegerField(
        choices=InviteStatus.as_choices(),
        default=InviteStatus.APPROVED.value,
        null=True,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmembermapping"
        unique_together = (("organization_id", "user"), ("organization_id", "email"))

    __repr__ = sane_repr("organization_id", "user_id", "role")
