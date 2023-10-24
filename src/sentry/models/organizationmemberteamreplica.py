from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseModel,
    BoundedAutoField,
    BoundedBigIntegerField,
    control_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@control_silo_only_model
class OrganizationMemberTeamReplica(BaseModel):
    """
    Identifies relationships between organization members and the teams they are on.
    """

    __relocation_scope__ = RelocationScope.Excluded

    id = BoundedAutoField(primary_key=True)
    team_id = HybridCloudForeignKey("sentry.Team", on_delete="CASCADE")
    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")
    organizationmember_id = BoundedBigIntegerField(db_index=True)
    organizationmemberteam_id = BoundedBigIntegerField(db_index=True)
    is_active = models.BooleanField()
    role = models.CharField(max_length=32, null=True, blank=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationmember_teamsreplica"
        unique_together = (("team_id", "organizationmember_id", "organization_id"),)

    __repr__ = sane_repr("team_id", "organizationmember_id", "organization_id")
