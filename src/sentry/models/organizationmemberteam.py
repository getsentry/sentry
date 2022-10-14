from typing import FrozenSet

from django.db import models

from sentry import features, roles
from sentry.db.models import (
    BaseModel,
    BoundedAutoField,
    FlexibleForeignKey,
    region_silo_only_model,
    sane_repr,
)
from sentry.roles import team_roles
from sentry.roles.manager import TeamRole


@region_silo_only_model
class OrganizationMemberTeam(BaseModel):
    """
    Identifies relationships between organization members and the teams they are on.
    """

    __include_in_export__ = True

    id = BoundedAutoField(primary_key=True)
    team = FlexibleForeignKey("sentry.Team")
    organizationmember = FlexibleForeignKey("sentry.OrganizationMember")
    # an inactive membership simply removes the team from the default list
    # but still allows them to re-join without request
    is_active = models.BooleanField(default=True)
    role = models.CharField(max_length=32, null=True, blank=True)

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

    def get_team_role(self) -> TeamRole:
        """Get this member's team-level role.

        If the role field is null, resolve to the minimum team role given by this
        member's organization role.
        """
        minimum_role = roles.get_minimum_team_role(self.organizationmember.role)
        if self.role and features.has(
            "organizations:team-roles", self.organizationmember.organization
        ):
            team_role = team_roles.get(self.role)
            if team_role.priority > minimum_role.priority:
                return team_role
        return minimum_role

    def get_scopes(self) -> FrozenSet[str]:
        """Get the scopes belonging to this member's team-level role."""
        if features.has("organizations:team-roles", self.organizationmember.organization):
            return self.organizationmember.organization.get_scopes(self.get_team_role())
        return frozenset()
