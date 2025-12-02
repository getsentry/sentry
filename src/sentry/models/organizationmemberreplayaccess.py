from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model, sane_repr
from sentry.hybridcloud.outbox.base import ReplicatedRegionModel
from sentry.hybridcloud.outbox.category import OutboxCategory


@region_silo_model
class OrganizationMemberReplayAccess(ReplicatedRegionModel):
    """
    Tracks which organization members have permission to access replay data.

    When no records exist for an organization, all members have access (default).
    When records exist, only members with a record can access replays.
    """

    __relocation_scope__ = RelocationScope.Organization
    category = OutboxCategory.ORGANIZATION_MEMBER_UPDATE

    organization = FlexibleForeignKey("sentry.Organization", related_name="replay_access_set")
    organizationmember = FlexibleForeignKey(
        "sentry.OrganizationMember",
        on_delete=models.CASCADE,
        related_name="replay_access",
    )
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmemberreplayaccess"
        unique_together = (("organization", "organizationmember"),)

    __repr__ = sane_repr("organization_id", "organizationmember_id")
