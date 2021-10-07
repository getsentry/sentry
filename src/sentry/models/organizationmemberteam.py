from django.db import models

from sentry.db.models import BaseModel, BoundedAutoField, FlexibleForeignKey, sane_repr


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
